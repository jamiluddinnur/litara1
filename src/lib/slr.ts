// Parsing RIS / BibTeX / CSV + relevance scoring + duplicate detection.
//
// CSV: parser RFC 4180 yang benar — field ber-kutip boleh berisi koma dan
// baris baru, strip BOM, deteksi delimiter otomatis (',' ';' tab '|'),
// dukung petunjuk "sep=", dekode UTF-16 / Windows-1252, file tanpa header
// tetap bisa dibaca, dan pemetaan header fleksibel Indonesia + Inggris
// (termasuk header khas Scopus: "Source title", "Author full names").
// Abstract yang tidak ada ditoleransi — bukan alasan gagal.
export interface ParsedArticle { title: string; authors: string; year?: number; journal: string; source: string; doi: string; abstract: string; keywords?: string; }
export interface ImportDiagnosis {
  format: "ris" | "bibtex" | "csv" | "unknown";
  delimiter: string;
  delimiterLabel: string;
  headers: string[];
  headerMapped: Record<string, string>;
  totalRows: number;
  read: number;
  skipped: number;
  skippedReasons: string[];
}

const clean = (s: string) => (s || "").replace(/[{}"]/g, "").trim();

/* ------------------------- RIS / BibTeX (dipertahankan) ------------------------- */
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

/* ------------------------- Dekode file (BOM / UTF-16 / Win-1252) ------------------------- */
export function decodeImportFile(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(buf.slice(3));
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf.slice(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(buf.slice(2));
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (!utf8.includes("\uFFFD")) return utf8.replace(/^\uFEFF/, "");
  // Banyak karakter pengganti: kemungkinan file Windows-1252 dari Excel lama.
  try { return new TextDecoder("windows-1252").decode(buf).replace(/^\uFEFF/, ""); } catch { return utf8.replace(/^\uFEFF/, ""); }
}

/* ------------------------- Parser CSV RFC 4180 ------------------------- */
// Satu pass atas seluruh teks: field ber-kutip boleh berisi delimiter dan
// newline. Jangan pernah split baris dulu.
function parseRecords(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      if (field === "") inQuotes = true; else field += ch;
    } else if (ch === delim) {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

const CANDIDATES: Array<{ d: string; label: string }> = [
  { d: ",", label: "koma (,)" },
  { d: ";", label: "titik koma (;)" },
  { d: "\t", label: "tab" },
  { d: "|", label: "pipa (|)" },
];

function detectDelimiter(text: string, firstLine: string): { d: string; label: string } {
  const sep = firstLine.match(/^sep=(.)\s*$/i);
  if (sep) { const hit = CANDIDATES.find((c) => c.d === sep[1]); if (hit) return hit; }
  const sample = text.split(/\r?\n/).slice(0, 6).join("\n");
  let best = CANDIDATES[0], bestScore = -1;
  for (const c of CANDIDATES) {
    const counts = sample.split(/\r?\n/).map((l) => (l.split(c.d).length - 1));
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const mean = total / counts.length;
    const variance = counts.reduce((a, b) => a + Math.abs(b - mean), 0) / counts.length;
    const score = total - variance * 2;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

const normHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "");

// Urutan penting: "sourcetitle" harus dipetakan ke jurnal SEBELUM "source".
const HEADER_ALIASES: Array<{ field: keyof ParsedArticle; names: string[] }> = [
  { field: "title", names: ["title", "documenttitle", "articletitle", "judul", "judulartikel", "ti", "namaartikel"] },
  { field: "authors", names: ["authors", "author", "authorsfullnames", "authorfullnames", "penulis", "namapenulis", "authorss"] },
  { field: "year", names: ["year", "tahun", "tahunterbit", "publicationyear", "py", "y1"] },
  { field: "journal", names: ["sourcetitle", "journal", "jurnal", "namajurnal", "journaltitle", "booktitle", "publication", "sourcetitleabbreviated"] },
  { field: "source", names: ["source", "sumber", "database", "origin"] },
  { field: "doi", names: ["doi"] },
  { field: "abstract", names: ["abstract", "abstrak"] },
  { field: "keywords", names: ["authorkeywords", "keywords", "katakunci", "indexkeywords", "keyword"] },
];
const HEADER_TOKENS = new Set(HEADER_ALIASES.flatMap((a) => a.names));

function mapHeaders(headers: string[]): { map: Record<string, keyof ParsedArticle>; mapped: Record<string, string> } {
  const map: Record<string, keyof ParsedArticle> = {};
  const mapped: Record<string, string> = {};
  headers.forEach((h, i) => {
    const n = normHeader(h);
    for (const alias of HEADER_ALIASES) {
      if (alias.names.includes(n)) { map[String(i)] = alias.field; mapped[h] = alias.field; break; }
    }
  });
  return { map, mapped };
}

function parseYear(v: string): number | undefined {
  const m = (v || "").match(/(19|20)\d{2}/);
  if (!m) return undefined;
  const y = parseInt(m[0], 10);
  return y >= 1000 && y <= 2100 ? y : undefined;
}

export function parseDelimitedDetailed(rawText: string): { articles: ParsedArticle[]; diagnosis: ImportDiagnosis } {
  let text = (rawText || "").replace(/^\uFEFF/, "");
  const skippedReasons: string[] = [];
  const firstLine = text.split(/\r?\n/)[0] || "";
  const hasSep = /^sep=.\s*$/i.test(firstLine);
  if (hasSep) text = text.split(/\r?\n/).slice(1).join("\n");
  const { d: delim, label } = detectDelimiter(text, hasSep ? "sep=" + firstLine.slice(4, 5) : firstLine);
  const rows = parseRecords(text, delim);
  if (rows.length === 0) {
    return { articles: [], diagnosis: { format: "csv", delimiter: delim, delimiterLabel: label, headers: [], headerMapped: {}, totalRows: 0, read: 0, skipped: 0, skippedReasons: ["File kosong atau tidak ada baris data."] } };
  }
  // Apakah baris pertama adalah header?
  const firstNorm = rows[0].map((c) => normHeader(c));
  const headerHits = firstNorm.filter((n) => HEADER_TOKENS.has(n)).length;
  const isHeader = headerHits > 0;
  let dataRows = rows;
  let headers: string[] = [];
  let colMap: Record<string, keyof ParsedArticle> = {};
  let headerMapped: Record<string, string> = {};
  if (isHeader) {
    headers = rows[0].map((c) => c.trim());
    const m = mapHeaders(headers);
    colMap = m.map; headerMapped = m.mapped;
    dataRows = rows.slice(1);
  } else {
    // Tanpa header: posisi baku Title, Authors, Year, Journal, Source, DOI, Abstract, Keywords.
    colMap = { "0": "title", "1": "authors", "2": "year", "3": "journal", "4": "source", "5": "doi", "6": "abstract", "7": "keywords" };
    skippedReasons.push("Tidak ada baris judul kolom — dipakai urutan baku: Judul, Penulis, Tahun, Jurnal, Sumber, DOI, Abstrak, Kata Kunci.");
  }
  const articles: ParsedArticle[] = [];
  let skipped = 0;
  dataRows.forEach((cells, i) => {
    const rowNo = i + (isHeader ? 2 : 1);
    // Baris header yang terulang di tengah file: lewati.
    if (cells.map((c) => normHeader(c)).filter((n) => HEADER_TOKENS.has(n)).length >= 2) { skipped++; skippedReasons.push(`Baris ${rowNo}: baris judul kolom yang terulang, dilewati.`); return; }
    const get = (field: keyof ParsedArticle) => {
      const idx = Object.keys(colMap).find((k) => colMap[k] === field);
      if (idx === undefined) return "";
      return (cells[Number(idx)] || "").trim();
    };
    const title = get("title");
    if (!title) { skipped++; if (skippedReasons.length < 10) skippedReasons.push(`Baris ${rowNo}: judul kosong, dilewati.`); return; }
    articles.push({
      title,
      authors: get("authors"),
      year: parseYear(get("year")),
      journal: get("journal"),
      source: get("source") || "CSV",
      doi: get("doi"),
      abstract: get("abstract"),
      keywords: get("keywords"),
    });
  });
  return {
    articles,
    diagnosis: {
      format: "csv", delimiter: delim, delimiterLabel: label, headers,
      headerMapped, totalRows: dataRows.length, read: articles.length, skipped,
      skippedReasons: skippedReasons.slice(0, 12),
    },
  };
}

export function parseCSV(text: string): ParsedArticle[] {
  return parseDelimitedDetailed(text).articles;
}

export function parseImport(text: string, filename = ""): ParsedArticle[] {
  if (/^TY\s*-/m.test(text) || filename.endsWith(".ris")) return parseRIS(text);
  if (/@\w+\s*\{/.test(text) || filename.endsWith(".bib")) return parseBibTeX(text);
  return parseCSV(text);
}

export interface ImportParseResult { articles: ParsedArticle[]; diagnosis: ImportDiagnosis; }
export function parseImportDetailed(text: string, filename = ""): ImportParseResult {
  if (/^TY\s*-/m.test(text) || filename.endsWith(".ris")) {
    const articles = parseRIS(text);
    return { articles, diagnosis: { format: "ris", delimiter: "", delimiterLabel: "-", headers: [], headerMapped: {}, totalRows: articles.length, read: articles.length, skipped: 0, skippedReasons: [] } };
  }
  if (/@\w+\s*\{/.test(text) || filename.endsWith(".bib")) {
    const articles = parseBibTeX(text);
    return { articles, diagnosis: { format: "bibtex", delimiter: "", delimiterLabel: "-", headers: [], headerMapped: {}, totalRows: articles.length, read: articles.length, skipped: 0, skippedReasons: [] } };
  }
  const { articles, diagnosis } = parseDelimitedDetailed(text);
  return { articles, diagnosis };
}

// Contoh CSV (format Scopus, koma) untuk tombol "Unduh contoh CSV".
export const SAMPLE_CSV = `Authors,Title,Year,Source title,DOI,Abstract,Author Keywords
"Sari, Dewi; Wijaya, Andi","Pengaruh Pembelajaran Daring terhadap Hasil Belajar Mahasiswa di Indonesia",2023,"Jurnal Pendidikan Indonesia",10.1234/jpi.2023.001,"Penelitian ini mengkaji pengaruh pembelajaran daring terhadap hasil belajar mahasiswa selama dan sesudah pandemi.","pembelajaran daring; hasil belajar"
"Chen, Li; Kumar, Raj","Systematic Review of Online Learning Effectiveness in Higher Education",2022,"Computers & Education",10.1016/j.compedu.2022.104,"A systematic review of 68 studies on online learning effectiveness, student engagement, and learning outcomes.","online learning; systematic review"
`;

const STOP = new Set("yang dan atau untuk dengan dari pada di ke dalam adalah sebagai pada sebuah ini itu tersebut oleh karena saat antara juga dapat bisa akan telah sudah the and for with from that this these those are was were has have had not but its into over under about between through after before".split(" "));
export function tokenize(text: string): string[] {
  return (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}
export function relevanceScore(article: ParsedArticle, question: string): number {
  const kws = tokenize(question).filter((w) => w.length > 3);
  if (!kws.length) return 50;
  const hay = `${article.title} ${article.abstract}`.toLowerCase();
  const hits = kws.filter((k) => hay.includes(k)).length;
  return Math.min(100, Math.round((hits / kws.length) * 100));
}

/* ------------------------- Naive Bayes untuk Peringkat Relevansi ------------------------- */
// Belajar dari keputusan tahap Judul & Abstrak tim sendiri.
// wordStats: { kata: [jumlahDiInclude, jumlahDiExclude] }
export interface TrainedModel { includeCount: number; excludeCount: number; wordStats: Record<string, [number, number]>; totalVocab: number; }
export function trainRelevance(decided: Array<{ article: { title: string; abstract: string }; value: "include" | "exclude" }>): TrainedModel {
  const wordStats: Record<string, [number, number]> = {};
  let includeCount = 0, excludeCount = 0;
  for (const d of decided) {
    const tokens = new Set(tokenize(`${d.article.title} ${d.article.abstract}`));
    if (d.value === "include") includeCount++; else excludeCount++;
    for (const t of tokens) {
      if (!wordStats[t]) wordStats[t] = [0, 0];
      if (d.value === "include") wordStats[t][0]++; else wordStats[t][1]++;
    }
  }
  return { includeCount, excludeCount, wordStats, totalVocab: Object.keys(wordStats).length };
}
export function scoreWithModel(model: TrainedModel, article: { title: string; abstract: string }): number {
  const tokens = new Set(tokenize(`${article.title} ${article.abstract}`));
  const totalDocs = model.includeCount + model.excludeCount;
  if (totalDocs === 0) return 50;
  const vocab = Math.max(model.totalVocab, 1);
  let logInc = Math.log((model.includeCount + 1) / (totalDocs + 2));
  let logExc = Math.log((model.excludeCount + 1) / (totalDocs + 2));
  for (const t of tokens) {
    const [ci, ce] = model.wordStats[t] || [0, 0];
    logInc += Math.log((ci + 1) / (model.includeCount + vocab));
    logExc += Math.log((ce + 1) / (model.excludeCount + vocab));
  }
  const diff = logInc - logExc;
  const p = 1 / (1 + Math.exp(-diff));
  return Math.max(0, Math.min(100, Math.round(p * 100)));
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

/** Potong rapi field impor yang terlalu panjang (server tidak lagi menolak batch). */
export function clampImport(a: ParsedArticle): { article: ParsedArticle; notes: string[] } {
  const notes: string[] = [];
  const cut = (v: string, max: number, label: string) => {
    if (v.length > max) { notes.push(`${label} dipotong dari ${v.length} menjadi ${max} karakter`); return v.slice(0, max); }
    return v;
  };
  return {
    article: {
      title: cut(a.title, 600, "Judul"),
      authors: cut(a.authors || "", 2000, "Penulis"),
      year: a.year && a.year >= 1000 && a.year <= 2100 ? a.year : undefined,
      journal: cut(a.journal || "", 300, "Jurnal"),
      source: cut(a.source || "CSV", 60, "Sumber"),
      doi: cut(a.doi || "", 200, "DOI"),
      abstract: cut(a.abstract || "", 20000, "Abstrak"),
      keywords: cut(a.keywords || "", 2000, "Kata kunci"),
    },
    notes,
  };
}
