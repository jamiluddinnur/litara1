import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/access";
import { trainRelevance, scoreWithModel, type TrainedModel } from "@/lib/slr";

const MIN_TOTAL = 50;
const MIN_EACH = 5;

// GET: kemajuan menuju ambang latih (50 keputusan tahap Judul & Abstrak,
// minimal 5 Include + 5 Exclude) + status model.
// POST: latih Naive Bayes dari keputusan tim, lalu beri skor semua artikel
// yang belum diputuskan pada tahap Judul & Abstrak.
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const access = await getProjectAccess(params.id, user.id);
    if (!access) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const progress = await relevanceProgress(params.id);
    const model = await prisma.relevanceModel.findUnique({ where: { projectId: params.id } });
    return NextResponse.json({ ...progress, ready: progress.total >= MIN_TOTAL && progress.included >= MIN_EACH && progress.excluded >= MIN_EACH, minTotal: MIN_TOTAL, minEach: MIN_EACH, trainedAt: model?.trainedAt || null });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}

async function relevanceProgress(projectId: string) {
  const articles = await prisma.article.findMany({
    where: { projectId },
    select: { id: true, decisions: { where: { stage: "title_abstract" }, select: { value: true } } },
  });
  // Satu artikel dihitung sekali per kelas keputusan (mayoritas tim).
  let included = 0, excluded = 0;
  for (const a of articles) {
    const vals = a.decisions.map((d) => d.value);
    if (vals.includes("include") && !vals.includes("exclude")) included++;
    else if (vals.includes("exclude") && !vals.includes("include")) excluded++;
  }
  return { total: included + excluded, included, excluded };
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const access = await getProjectAccess(params.id, user.id);
    if (!access) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const progress = await relevanceProgress(params.id);
    if (progress.total < MIN_TOTAL || progress.included < MIN_EACH || progress.excluded < MIN_EACH) {
      return NextResponse.json({ error: `Peringkat relevansi belum siap. Dibutuhkan ${MIN_TOTAL} keputusan tahap Judul & Abstrak (saat ini ${progress.total}), minimal ${MIN_EACH} Include dan ${MIN_EACH} Exclude (saat ini ${progress.included} Include, ${progress.excluded} Exclude).` }, { status: 400 });
    }
    const articles = await prisma.article.findMany({
      where: { projectId: params.id },
      select: { id: true, title: true, abstract: true, decisions: { where: { stage: "title_abstract" }, select: { value: true } } },
    });
    const decided: Array<{ article: { title: string; abstract: string }; value: "include" | "exclude" }> = [];
    const undecided: Array<{ id: string; title: string; abstract: string }> = [];
    for (const a of articles) {
      const vals = a.decisions.map((d) => d.value);
      if (vals.includes("include") && !vals.includes("exclude")) decided.push({ article: { title: a.title, abstract: a.abstract }, value: "include" });
      else if (vals.includes("exclude") && !vals.includes("include")) decided.push({ article: { title: a.title, abstract: a.abstract }, value: "exclude" });
      else if (vals.length === 0) undecided.push({ id: a.id, title: a.title, abstract: a.abstract });
    }
    const model: TrainedModel = trainRelevance(decided);
    await prisma.relevanceModel.upsert({
      where: { projectId: params.id },
      update: { trainedAt: new Date(), includeCount: model.includeCount, excludeCount: model.excludeCount, wordStats: model.wordStats as object, totalVocab: model.totalVocab },
      create: { projectId: params.id, includeCount: model.includeCount, excludeCount: model.excludeCount, wordStats: model.wordStats as object, totalVocab: model.totalVocab },
    });
    let scored = 0;
    for (const a of undecided) {
      const s = scoreWithModel(model, { title: a.title, abstract: a.abstract });
      await prisma.article.update({ where: { id: a.id }, data: { learned: s } });
      scored++;
    }
    return NextResponse.json({ ok: true, trained: decided.length, scored, includeCount: model.includeCount, excludeCount: model.excludeCount });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
