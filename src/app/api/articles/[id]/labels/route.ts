import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getProjectAccess, canScreen } from "@/lib/access";

// Ubah label artikel (dipisah koma, mis. "metode kuantitatif, prioritas baca").
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { labels } = await req.json();
    const article = await prisma.article.findUnique({ where: { id: params.id }, select: { id: true, projectId: true } });
    if (!article) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    const access = await getProjectAccess(article.projectId, user.id);
    if (!access) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    if (!canScreen(access.role)) return NextResponse.json({ error: "Peran Pengamat hanya bisa melihat." }, { status: 403 });
    const updated = await prisma.article.update({ where: { id: params.id }, data: { labels: String(labels || "").slice(0, 300) } });
    return NextResponse.json({ ok: true, labels: updated.labels });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
