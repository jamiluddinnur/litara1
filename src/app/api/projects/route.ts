import { NextResponse } from "next/server";
import { prisma, PLANS } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
export async function GET() {
  try {
    const user = await requireUser();
    const projects = await prisma.project.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { articles: true } }, articles: { select: { id: true, decisions: { select: { value: true } } } } } });
    const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
    return NextResponse.json({ projects: projects.map((p) => ({ id: p.id, title: p.title, researchQuestion: p.researchQuestion, inclusion: p.inclusion, exclusion: p.exclusion, createdAt: p.createdAt, total: p._count.articles, screened: p.articles.filter((a) => a.decisions.length > 0).length, included: p.articles.filter((a) => a.decisions.some((d) => d.value === "include")).length })), plan: sub?.plan || "free" });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
    const plan = (sub?.plan || "free") as keyof typeof PLANS;
    const count = await prisma.project.count({ where: { ownerId: user.id } });
    if (count >= PLANS[plan].maxProjects) return NextResponse.json({ error: `Paket ${PLANS[plan].name} dibatasi ${PLANS[plan].maxProjects} proyek. Upgrade ke Pro untuk proyek lebih banyak.` }, { status: 403 });
    const { title, researchQuestion, inclusion, exclusion } = await req.json();
    if (!title || !researchQuestion) return NextResponse.json({ error: "Judul dan pertanyaan riset wajib diisi." }, { status: 400 });
    const p = await prisma.project.create({ data: { title, researchQuestion, inclusion: inclusion || "", exclusion: exclusion || "", ownerId: user.id, reviewers: { create: [{ name: user.name }] } } });
    return NextResponse.json({ ok: true, project: p });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
