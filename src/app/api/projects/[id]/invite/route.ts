import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getProjectAccess, canManage } from "@/lib/access";

// Undang kolaborator via email (harus sudah punya akun Litara) dengan peran
// editor | reviewer | viewer. GET mengembalikan daftar anggota + peran.
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const access = await getProjectAccess(params.id, user.id);
    if (!access) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const owner = await prisma.user.findUnique({ where: { id: access.project.ownerId }, select: { id: true, name: true, email: true } });
    const members = access.project.members.map((m) => ({ id: m.id, userId: m.userId, name: m.user.name, email: m.user.email, role: m.role }));
    return NextResponse.json({ owner, members });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { email, role } = await req.json();
    const r = ["editor", "reviewer", "viewer"].includes(role) ? role : "reviewer";
    const access = await getProjectAccess(params.id, user.id);
    if (!access) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    if (!canManage(access.role)) return NextResponse.json({ error: "Hanya pemilik atau editor yang bisa mengundang." }, { status: 403 });
    if (!email) return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });
    const invited = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!invited) return NextResponse.json({ error: "Pengguna dengan email itu belum terdaftar di Litara. Minta mereka daftar dulu, lalu undang lagi." }, { status: 404 });
    if (invited.id === access.project.ownerId) return NextResponse.json({ error: "Email itu adalah pemilik proyek." }, { status: 400 });
    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: params.id, userId: invited.id } },
      update: { role: r },
      create: { projectId: params.id, userId: invited.id, role: r },
    });
    // Reviewer tercatat juga di daftar nama reviewer proyek (untuk keputusan lama).
    await prisma.reviewer.upsert({
      where: { projectId_name: { projectId: params.id, name: invited.name } },
      update: {},
      create: { projectId: params.id, name: invited.name },
    });
    return NextResponse.json({ ok: true, member: { id: member.id, name: invited.name, email: invited.email, role: member.role } });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
