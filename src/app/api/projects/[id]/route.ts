import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const p = await prisma.project.findFirst({ where: { id: params.id, ownerId: user.id }, include: { articles: { orderBy: { createdAt: "asc" }, include: { decisions: true } }, reviewers: true } });
    if (!p) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const total = p.articles.length;
    const dups = p.articles.filter((a) => a.duplicateOfId).length;
    const decided = p.articles.filter((a) => a.decisions.length > 0);
    const included = decided.filter((a) => a.decisions.some((d) => d.value === "include")).length;
    const excluded = decided.filter((a) => a.decisions.some((d) => d.value === "exclude")).length;
    const conflicts = p.articles.filter((a) => { const v = new Set(a.decisions.map((d) => d.value)); return v.size > 1; }).length;
    return NextResponse.json({ project: p, prisma: { identified: total, duplicatesRemoved: dups, screened: decided.length, included, excluded, pending: total - decided.length, conflicts } });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
