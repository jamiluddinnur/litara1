// Parsing RIS / BibTeX / CSV + relevance scoring + duplicate detection.
export interface ParsedArticle { title: string; authors: string; year?: number; journal: string; source: string; doi: string; abstract: string; }
const clean = (s: string) => (s || "").replace(/[{}"]/g, "").trim();
export function parseRIS(text: string): ParsedArticle[] {
  const out: ParsedArticle[] = []; let cur: Record<string, string> = {};
  const flush = () => { if (cur.TI || cur.title) out.push({ title: clean(cur.TI || cur.title || ""), authors: clean(cur.AU || ""), year: parseInt(cur.Y1 || cur.PY || "") || undefined, journal: clean(cur.JO || cur.T2 || ""), source: clean(cur.DB || "RIS"), doi: clean(cur.DO || ""), abstract: clean(cur.AB || "") }); cur = {}; };
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9]{2})\s*-\s*(.*)$/);
    if (!m) continue;
    if (m[1] === "TY") cur = {};
    else if (m[1] === "ER") flush();
    else cur[m[1]] = (cur[m[1]] ? cur[m[1]] + "; " : "") + m[2];
  }
  flush(); return out.filter((a) => a.title);
}
export function parseBibTeX(text: string): ParsedArticle[] {
  const out: ParsedArticle[] = [];
  const entries = text.split(/@\w+\s*\{/);
  for (const e of entries.slice(1)) {
    const get = (k: string) => { const m = e.match(new RegExp(`${k}\\s*=\\s*\\{([^}]*)\\}`, "i")); return m ? clean(m[1]) : ""; };
    const title = get("title"); if (!title) continue;
    out.push({ title, authors: get("author"), year: parseInt(get("year")) || undefined, journal: get("journal") || get("booktitle"), source: "BibTeX", doi: get("doi"), abstract: get("abstract") });
  }
  return out;
}
export function parseCSV(text: string): ParsedArticle[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const split = (l: string) => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.replace(/^"|"$/g, "").trim());
  const h = split(lines[0]).map((x) => x.toLowerCase());
  const idx = (k: string) => h.findIndex((x) => x.includes(k));
  return lines.slice(1).map((l) => { const c = split(l); return { title: c[idx("title")] || "", authors: c[idx("author")] || "", year: parseInt(c[idx("year")] || "") || undefined, journal: c[idx("journal")] || "", source: c[idx("source")] || "CSV", doi: c[idx("doi")] || "", abstract: c[idx("abstract")] || "" }; }).filter((a) => a.title);
}
export function parseImport(text: string, filename = ""): ParsedArticle[] {
  if (/^TY\s*-/m.test(text) || filename.endsWith(".ris")) return parseRIS(text);
  if (/@\w+\s*\{/.test(text) || filename.endsWith(".bib")) return parseBibTeX(text);
  return parseCSV(text);
}
const STOP = new Set("yang dan atau untuk dengan dari pada di ke dalam adalah sebagai pada sebuah ini itu tersebut oleh karena saat antara juga dapat bisa akan telah sudah yang".split(" "));
export function relevanceScore(article: ParsedArticle, question: string): number {
  const kws = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
  if (!kws.length) return 50;
  const hay = `${article.title} ${article.abstract}`.toLowerCase();
  const hits = kws.filter((k) => hay.includes(k)).length;
  return Math.min(100, Math.round((hits / kws.length) * 100));
}
export function normTitle(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
export function isDuplicate(a: ParsedArticle, b: { doi: string; title: string }): boolean {
  if (a.doi && b.doi && a.doi.toLowerCase() === b.doi.toLowerCase()) return true;
  const x = normTitle(a.title), y = normTitle(b.title);
  return x.length > 10 && (x === y || (x.length > 20 && (x.includes(y.slice(0, 30)) || y.includes(x.slice(0, 30)))));
}
export function prismaCounts(decisions: { value: string }[]) {
  const inc = decisions.filter((d) => d.value === "include").length;
  const exc = decisions.filter((d) => d.value === "exclude").length;
  return { screened: decisions.length, included: inc, excluded: exc };
}
