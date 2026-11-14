import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getProjectAccess, canScreen } from "@/lib/access";
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { value, reason, reviewer, stage } = await req.json();
    if (!["include", "exclude", "maybe"].includes(value)) return NextResponse.json({ error: "Keputusan tidak valid." }, { status: 400 });
    const st = stage === "fulltext" ? "fulltext" : "title_abstract";
    const article = await prisma.article.findUnique({ where: { id: params.id }, select: { id: true, projectId: true } });
    if (!article) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    const access = await getProjectAccess(article.projectId, user.id);
    if (!access) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    if (!canScreen(access.role)) return NextResponse.json({ error: "Peran Pengamat hanya bisa melihat, tidak bisa screening." }, { status: 403 });
    const name = reviewer || user.name;
    const d = await prisma.decision.upsert({
      where: { articleId_reviewer_stage: { articleId: params.id, reviewer: name, stage: st } },
      update: { value, reason: reason || "", userId: user.id },
      create: { articleId: params.id, reviewer: name, value, reason: reason || "", userId: user.id, stage: st },
    });
    return NextResponse.json({ ok: true, decision: d });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
