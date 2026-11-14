import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getProjectAccess, canScreen } from "@/lib/access";
import { parseImportDetailed, relevanceScore, isDuplicate, clampImport, type ParsedArticle } from "@/lib/slr";

// Impor tidak lagi all-or-nothing: baris bermasalah dilewati dan dilaporkan,
// field terlalu panjang dipotong rapi, batch besar diproses per 200 baris.
const CHUNK = 200;
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const access = await getProjectAccess(params.id, user.id);
    if (!access) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    if (!canScreen(access.role)) return NextResponse.json({ error: "Peran Pengamat hanya bisa melihat, tidak bisa mengimpor." }, { status: 403 });
    const project = access.project;
    const { text, filename, article } = await req.json();
    let parsed: ParsedArticle[] = [];
    let diagnosis: any = null;
    if (article?.title) parsed = [article];
    else if (text) {
      const r = parseImportDetailed(String(text), filename || "");
      parsed = r.articles; diagnosis = r.diagnosis;
    }
    if (!parsed.length) {
      const hint = diagnosis?.skippedReasons?.length
        ? ` ${diagnosis.skippedReasons.slice(0, 3).join(" ")}`
        : "";
      return NextResponse.json({ error: `Tidak ada referensi yang bisa diimpor.${hint} Periksa format RIS / BibTeX / CSV — kolom Judul wajib ada.`, diagnosis }, { status: 400 });
    }
    const existing = await prisma.article.findMany({ where: { projectId: project.id }, select: { doi: true, title: true } });
    let imported = 0, duplicates = 0, skipped = 0;
    const skippedReasons: string[] = [...(diagnosis?.skippedReasons || [])];
    if (diagnosis) skipped += diagnosis.skipped;
    const notes: string[] = [];
    for (let start = 0; start < parsed.length; start += CHUNK) {
      const chunk = parsed.slice(start, start + CHUNK);
      for (let i = 0; i < chunk.length; i++) {
        const raw = chunk[i];
        const rowNo = start + i + 1;
        if (!raw.title || !raw.title.trim()) { skipped++; if (skippedReasons.length < 12) skippedReasons.push(`Baris ${rowNo}: judul kosong, dilewati.`); continue; }
        const { article: a, notes: cutNotes } = clampImport(raw);
        if (cutNotes.length && notes.length < 5) notes.push(`Baris ${rowNo}: ${cutNotes.join("; ")}.`);
        const dup = existing.some((e) => isDuplicate(a, e));
        try {
          await prisma.article.create({ data: { projectId: project.id, title: a.title, authors: a.authors || "", year: a.year || null, journal: a.journal || "", source: a.source || "Manual", doi: a.doi || "", abstract: a.abstract || "", keywords: a.keywords || "", relevance: relevanceScore(a, project.researchQuestion), duplicateOfId: dup ? "doi-duplikat" : null } });
        } catch (e: any) {
          skipped++;
          if (skippedReasons.length < 12) skippedReasons.push(`Baris ${rowNo} ("${a.title.slice(0, 60)}"): gagal disimpan (${e?.message || "error database"}).`);
          continue;
        }
        if (dup) duplicates++; else imported++;
        existing.push({ doi: a.doi || "", title: a.title });
      }
    }
    return NextResponse.json({ ok: true, imported, duplicates, skipped, total: parsed.length, skippedReasons: skippedReasons.slice(0, 12), notes, diagnosis });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
