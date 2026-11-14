import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/access";
import { SAMPLE_CSV } from "@/lib/slr";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const type = new URL(req.url).searchParams.get("type") || "csv";
    // Contoh CSV untuk panel impor — tidak butuh proyek.
    if (type === "sample") {
      return new NextResponse(SAMPLE_CSV, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="litara-contoh.csv"` } });
    }
    const access = await getProjectAccess(params.id, user.id);
    if (!access) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const p = await prisma.project.findFirst({ where: { id: params.id }, include: { articles: { include: { decisions: true, extractions: true, riskAssessments: true } } } });
    if (!p) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const verdict = (a: (typeof p.articles)[number], stage: string) => {
      if (stage === "title_abstract" && a.consensus) return a.consensus;
      const vals = a.decisions.filter((d) => d.stage === stage).map((d) => d.value);
      if (vals.includes("include")) return "include";
      if (vals.includes("exclude")) return "exclude";
      return vals.includes("maybe") ? "maybe" : "pending";
    };
    if (type === "ris") {
      const body = p.articles.filter((a) => verdict(a, "title_abstract") === "include").map((a) => `TY  - JOUR\nTI  - ${a.title}\nAU  - ${a.authors}\nPY  - ${a.year || ""}\nJO  - ${a.journal}\nDO  - ${a.doi}\nER  - `).join("\n");
      return new NextResponse(body, { headers: { "Content-Type": "text/plain", "Content-Disposition": `attachment; filename="litara-include.ris"` } });
    }
    if (type === "txt") {
      const ta = p.articles.filter((a) => a.decisions.some((d) => d.stage === "title_abstract")).length;
      const ft = p.articles.filter((a) => a.decisions.some((d) => d.stage === "fulltext"));
      const body = `PRISMA 2020 — ${p.title}\nTeridentifikasi: ${p.articles.length}\nDuplikat: ${p.articles.filter((a) => a.duplicateOfId).length}\nDisaring (judul/abstrak): ${ta}\nInclude tahap judul/abstrak: ${p.articles.filter((a) => verdict(a, "title_abstract") === "include").length}\nExclude tahap judul/abstrak: ${p.articles.filter((a) => verdict(a, "title_abstract") === "exclude").length}\nDinilai teks lengkap: ${ft.length}\nInclude teks lengkap: ${ft.filter((a) => verdict(a, "fulltext") === "include").length}\nEkstraksi data selesai: ${p.articles.filter((a) => a.extractions.length).length}\nRisk of Bias dinilai: ${p.articles.filter((a) => a.riskAssessments.length).length}\nMenunggu: ${p.articles.length - ta}\n`;
      return new NextResponse(body, { headers: { "Content-Type": "text/plain", "Content-Disposition": `attachment; filename="litara-prisma.txt"` } });
    }
    // CSV memakai pemisah ';' (format ekspor Litara) dengan header Indonesia.
    const q = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const rows = [["Judul", "Penulis", "Tahun", "Jurnal", "Sumber", "DOI", "Skor Relevansi", "Skor Terlatih", "Keputusan Judul/Abstrak", "Keputusan Teks Lengkap", "Konsensus"].join(";")];
    for (const a of p.articles) {
      rows.push([a.title, a.authors, String(a.year || ""), a.journal, a.source, a.doi, String(a.relevance), a.learned == null ? "" : String(a.learned), verdict(a, "title_abstract"), verdict(a, "fulltext"), a.consensus || ""].map(q).join(";"));
    }
    return new NextResponse("\uFEFF" + rows.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="litara-screening.csv"` } });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
