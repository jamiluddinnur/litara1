import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { value, reason, reviewer } = await req.json();
    if (!["include", "exclude", "maybe"].includes(value)) return NextResponse.json({ error: "Keputusan tidak valid." }, { status: 400 });
    const article = await prisma.article.findUnique({ where: { id: params.id }, include: { project: true } });
    if (!article || article.project.ownerId !== user.id) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    const name = reviewer || user.name;
    const d = await prisma.decision.upsert({ where: { articleId_reviewer: { articleId: params.id, reviewer: name } }, update: { value, reason: reason || "", userId: user.id }, create: { articleId: params.id, reviewer: name, value, reason: reason || "", userId: user.id } });
    return NextResponse.json({ ok: true, decision: d });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
