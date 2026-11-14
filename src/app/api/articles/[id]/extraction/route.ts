import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getProjectAccess, canScreen } from "@/lib/access";

// GET: ekstraksi milik reviewer saat ini untuk artikel ini.
// POST: simpan/upsert formulir ekstraksi terstruktur per studi.
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const article = await prisma.article.findUnique({ where: { id: params.id }, select: { id: true, projectId: true } });
    if (!article) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    const access = await getProjectAccess(article.projectId, user.id);
    if (!access) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    const rows = await prisma.extraction.findMany({ where: { articleId: params.id } });
    return NextResponse.json({ extractions: rows });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { design, population, intervention, outcomes, sampleSize, notes, reviewer } = await req.json();
    const article = await prisma.article.findUnique({ where: { id: params.id }, select: { id: true, projectId: true } });
    if (!article) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    const access = await getProjectAccess(article.projectId, user.id);
    if (!access) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    if (!canScreen(access.role)) return NextResponse.json({ error: "Peran Pengamat hanya bisa melihat." }, { status: 403 });
    const name = reviewer || user.name;
    const row = await prisma.extraction.upsert({
      where: { articleId_reviewer: { articleId: params.id, reviewer: name } },
      update: { design: design || "", population: population || "", intervention: intervention || "", outcomes: outcomes || "", sampleSize: sampleSize || "", notes: notes || "" },
      create: { articleId: params.id, reviewer: name, design: design || "", population: population || "", intervention: intervention || "", outcomes: outcomes || "", sampleSize: sampleSize || "", notes: notes || "" },
    });
    return NextResponse.json({ ok: true, extraction: row });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
