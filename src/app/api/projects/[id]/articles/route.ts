import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseImport, relevanceScore, isDuplicate, type ParsedArticle } from "@/lib/slr";
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const project = await prisma.project.findFirst({ where: { id: params.id, ownerId: user.id } });
    if (!project) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const { text, filename, article } = await req.json();
    let parsed: ParsedArticle[] = [];
    if (article?.title) parsed = [article];
    else if (text) parsed = parseImport(String(text), filename || "");
    if (!parsed.length) return NextResponse.json({ error: "Tidak ada referensi yang bisa diimpor. Periksa format RIS / BibTeX / CSV." }, { status: 400 });
    const existing = await prisma.article.findMany({ where: { projectId: project.id }, select: { doi: true, title: true } });
    let imported = 0, duplicates = 0;
    for (const a of parsed) {
      const dup = isDuplicate(a, existing[0] || { doi: "", title: "" }) || existing.some((e) => isDuplicate(a, e));
      await prisma.article.create({ data: { projectId: project.id, title: a.title, authors: a.authors || "", year: a.year || null, journal: a.journal || "", source: a.source || "Manual", doi: a.doi || "", abstract: a.abstract || "", relevance: relevanceScore(a, project.researchQuestion), duplicateOfId: dup ? "doi-duplikat" : null } });
      if (dup) duplicates++; else imported++;
      existing.push({ doi: a.doi || "", title: a.title });
    }
    return NextResponse.json({ ok: true, imported, duplicates, total: parsed.length });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
