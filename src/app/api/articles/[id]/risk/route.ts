import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getProjectAccess, canScreen } from "@/lib/access";

// Penilaian Risk of Bias: 5 domain (0 belum dinilai, 1 rendah, 2 sedang, 3 tinggi)
// + penilaian keseluruhan, per reviewer.
const DOMAINS = ["selection", "performance", "detection", "attrition", "reporting"] as const;
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const article = await prisma.article.findUnique({ where: { id: params.id }, select: { id: true, projectId: true } });
    if (!article) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    const access = await getProjectAccess(article.projectId, user.id);
    if (!access) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    const rows = await prisma.riskAssessment.findMany({ where: { articleId: params.id } });
    return NextResponse.json({ assessments: rows });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const article = await prisma.article.findUnique({ where: { id: params.id }, select: { id: true, projectId: true } });
    if (!article) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    const access = await getProjectAccess(article.projectId, user.id);
    if (!access) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
    if (!canScreen(access.role)) return NextResponse.json({ error: "Peran Pengamat hanya bisa melihat." }, { status: 403 });
    const name = body.reviewer || user.name;
    const vals: Record<string, number> = {};
    for (const d of DOMAINS) {
      const v = Number(body[d]);
      vals[d] = [0, 1, 2, 3].includes(v) ? v : 0;
    }
    const row = await prisma.riskAssessment.upsert({
      where: { articleId_reviewer: { articleId: params.id, reviewer: name } },
      update: { ...vals, overall: body.overall || "", notes: body.notes || "" },
      create: { articleId: params.id, reviewer: name, ...vals, overall: body.overall || "", notes: body.notes || "" },
    });
    return NextResponse.json({ ok: true, assessment: row });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
