import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const type = new URL(req.url).searchParams.get("type") || "csv";
    const p = await prisma.project.findFirst({ where: { id: params.id, ownerId: user.id }, include: { articles: { include: { decisions: true } } } });
    if (!p) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const dec = (a: { decisions: { value: string }[] }) => a.decisions[0]?.value || "pending";
    if (type === "ris") {
      const body = p.articles.filter((a) => dec(a) === "include").map((a) => `TY  - JOUR\nTI  - ${a.title}\nAU  - ${a.authors}\nPY  - ${a.year || ""}\nJO  - ${a.journal}\nDO  - ${a.doi}\nER  - `).join("\n");
      return new NextResponse(body, { headers: { "Content-Type": "text/plain", "Content-Disposition": `attachment; filename="litara-include.ris"` } });
    }
    if (type === "txt") {
      const inc = p.articles.filter((a) => dec(a) === "include").length, exc = p.articles.filter((a) => dec(a) === "exclude").length;
      const body = `PRISMA 2020 — ${p.title}\nTeridentifikasi: ${p.articles.length}\nDuplikat: ${p.articles.filter((a) => a.duplicateOfId).length}\nDisaring: ${p.articles.filter((a) => a.decisions.length).length}\nInclude: ${inc}\nExclude: ${exc}\nMenunggu: ${p.articles.length - p.articles.filter((a) => a.decisions.length).length}\n`;
      return new NextResponse(body, { headers: { "Content-Type": "text/plain", "Content-Disposition": `attachment; filename="litara-prisma.txt"` } });
    }
    const rows = [["Judul", "Penulis", "Tahun", "Jurnal", "Sumber", "DOI", "Skor", "Keputusan"].join(",")];
    for (const a of p.articles) rows.push([a.title, a.authors, String(a.year || ""), a.journal, a.source, a.doi, String(a.relevance), dec(a)].map((s) => `"${String(s).replace(/"/g, '""')}"`).join(","));
    return new NextResponse(rows.join("\n"), { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="litara-screening.csv"` } });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
