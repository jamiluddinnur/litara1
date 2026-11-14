import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getProjectAccess, canManage } from "@/lib/access";

// Tetapkan keputusan konsensus untuk artikel yang berkonflik (tab Tim).
// Hanya pemilik / editor. Konsensus mengalahkan keputusan per-reviewer di PRISMA.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { value } = await req.json();
    if (!["include", "exclude", ""].includes(value)) return NextResponse.json({ error: "Nilai konsensus tidak valid." }, { status: 400 });
    const article = await prisma.article.findUnique({ where: { id: params.id }, select: { id: true, projectId: true } });
    if (!article) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    const access = await getProjectAccess(article.projectId, user.id);
    if (!access) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    if (!canManage(access.role)) return NextResponse.json({ error: "Hanya pemilik atau editor yang bisa menetapkan konsensus." }, { status: 403 });
    const updated = await prisma.article.update({ where: { id: params.id }, data: { consensus: value || "" } });
    return NextResponse.json({ ok: true, consensus: updated.consensus });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
