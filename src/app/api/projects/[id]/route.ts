import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getProjectAccess, canManage } from "@/lib/access";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const access = await getProjectAccess(params.id, user.id);
    if (!access) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const p = await prisma.project.findFirst({
      where: { id: params.id },
      include: {
        articles: {
          orderBy: { createdAt: "asc" },
          include: { decisions: true, extractions: true, riskAssessments: true },
        },
        reviewers: true,
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        relevanceModel: true,
      },
    });
    if (!p) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const isOwner = access.role === "owner";
    // Blind Mode: anggota tim hanya melihat keputusan sendiri sampai mode dibuka.
    // Pemilik tetap melihat semua (untuk mengelola), konflik dihitung dari data lengkap.
    const visibleArticles = p.articles.map((a) => {
      if (p.blindMode && !isOwner) {
        return { ...a, decisions: a.decisions.filter((d) => d.userId === user.id || d.reviewer === user.name) };
      }
      return a;
    });
    const total = p.articles.length;
    const dups = p.articles.filter((a) => a.duplicateOfId).length;
    const taDecided = p.articles.filter((a) => a.decisions.some((d) => d.stage === "title_abstract"));
    const verdict = (a: (typeof p.articles)[number]) => {
      if (a.consensus) return a.consensus;
      const vals = a.decisions.filter((d) => d.stage === "title_abstract").map((d) => d.value);
      if (vals.includes("include")) return "include";
      if (vals.includes("exclude")) return "exclude";
      return "pending";
    };
    const included = p.articles.filter((a) => verdict(a) === "include").length;
    const excluded = p.articles.filter((a) => verdict(a) === "exclude").length;
    const conflicts = p.articles.filter((a) => {
      const v = new Set(a.decisions.filter((d) => d.stage === "title_abstract").map((d) => d.value));
      return v.has("include") && v.has("exclude") && !a.consensus;
    });
    const ft = p.articles.filter((a) => a.decisions.some((d) => d.stage === "fulltext"));
    const ftInc = ft.filter((a) => {
      const vals = a.decisions.filter((d) => d.stage === "fulltext").map((d) => d.value);
      return vals.includes("include");
    }).length;
    const extracted = p.articles.filter((a) => a.extractions.length > 0).length;
    const riskAssessed = p.articles.filter((a) => a.riskAssessments.length > 0).length;
    return NextResponse.json({
      project: { ...p, articles: visibleArticles },
      role: access.role,
      prisma: {
        identified: total, duplicatesRemoved: dups,
        screened: taDecided.length, included, excluded, pending: total - taDecided.length,
        conflicts: conflicts.length,
        conflictArticleIds: conflicts.map((a) => a.id),
        fulltextAssessed: ft.length, fulltextIncluded: ftInc, fulltextExcluded: ft.length - ftInc,
        extracted, riskAssessed,
      },
    });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}

// PATCH: ubah Blind Mode (pemilik / editor).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const access = await getProjectAccess(params.id, user.id);
    if (!access) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    if (!canManage(access.role)) return NextResponse.json({ error: "Hanya pemilik atau editor yang bisa mengubah Blind Mode." }, { status: 403 });
    const { blindMode } = await req.json();
    const p = await prisma.project.update({ where: { id: params.id }, data: { blindMode: !!blindMode } });
    return NextResponse.json({ ok: true, blindMode: p.blindMode });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
