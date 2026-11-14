"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Logo from "@/components/Logo";
import { parseImportDetailed, decodeImportFile, tokenize } from "@/lib/slr";

type Me = { id: string; name: string; email: string } | null;
type Decision = { reviewer: string; value: string; reason?: string; stage: string };
type Extraction = { reviewer: string; design: string; population: string; intervention: string; outcomes: string; sampleSize: string; notes: string };
type Risk = { reviewer: string; selection: number; performance: number; detection: number; attrition: number; reporting: number; overall: string; notes: string };
type Article = { id: string; title: string; authors: string; year?: number; journal: string; source: string; doi: string; abstract: string; keywords?: string; relevance: number; learned?: number | null; consensus?: string; duplicateOfId?: string | null; labels?: string; decisions: Decision[]; extractions: Extraction[]; riskAssessments: Risk[] };
type Project = { id: string; title: string; researchQuestion: string; inclusion: string; exclusion: string; blindMode: boolean; total: number; screened: number; included: number; createdAt: string };
type Prisma = { identified: number; duplicatesRemoved: number; screened: number; included: number; excluded: number; pending: number; conflicts: number; conflictArticleIds: string[]; fulltextAssessed: number; fulltextIncluded: number; fulltextExcluded: number; extracted: number; riskAssessed: number };
type Detail = { project: { id: string; title: string; researchQuestion: string; inclusion: string; exclusion: string; blindMode: boolean; articles: Article[]; reviewers: { name: string }[] }; role: string; prisma: Prisma };
type RelProg = { total: number; included: number; excluded: number; ready: boolean; minTotal: number; minEach: number; trainedAt: string | null };

const SAMPLE_RIS = `TY  - JOUR\nTI  - Pembelajaran Daring dan Hasil Belajar Mahasiswa Indonesia\nAU  - Sari, Dewi\nY1  - 2024\nJO  - Jurnal Pendidikan Indonesia\nDO  - 10.1234/contoh.2024.01\nAB  - Tinjauan sistematis tentang pembelajaran daring dan hasil belajar mahasiswa.\nER  - \nTY  - JOUR\nTI  - Blended Learning dan Motivasi Belajar\nAU  - Putri, Maya\nY1  - 2023\nJO  - Jurnal Teknologi Pendidikan\nER  - `;

const STAGES = [
  { key: "title_abstract", label: "1. Judul & Abstrak" },
  { key: "fulltext", label: "2. Teks Lengkap" },
  { key: "extraction", label: "3. Ekstraksi Data" },
  { key: "risk", label: "4. Risk of Bias" },
] as const;
type StageKey = (typeof STAGES)[number]["key"];

const EXCLUDE_REASONS = ["Bukan populasi target", "Intervensi tidak sesuai", "Bukan studi empiris", "Tidak ada teks penuh", "Di luar rentang tahun", "Duplikat", "Jenis publikasi tidak sesuai", "Lainnya"];
const ROB_DOMAINS = [
  { key: "selection", label: "Bias Seleksi" },
  { key: "performance", label: "Bias Kinerja" },
  { key: "detection", label: "Bias Deteksi" },
  { key: "attrition", label: "Bias Atrisi" },
  { key: "reporting", label: "Bias Pelaporan" },
] as const;
const ROB_LEVELS = ["Belum dinilai", "Rendah", "Sedang", "Tinggi"];

export default function Home() {
  const [me, setMe] = useState<Me>(null);
  const [plan, setPlan] = useState("free");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState("screening");
  const [stage, setStage] = useState<StageKey>("title_abstract");
  const [selId, setSelId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [decFilter, setDecFilter] = useState("all");
  const [srcFilter, setSrcFilter] = useState("all");
  const [sortMode, setSortMode] = useState("learned");
  const [reviewer, setReviewer] = useState("");
  const [newProj, setNewProj] = useState({ title: "", researchQuestion: "", inclusion: "", exclusion: "" });
  const [importText, setImportText] = useState("");
  const [importName, setImportName] = useState("");
  const [importDiag, setImportDiag] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [payMode, setPayMode] = useState("");
  const [yearly, setYearly] = useState(false);
  const [excludeReason, setExcludeReason] = useState(EXCLUDE_REASONS[0]);
  const [labelInput, setLabelInput] = useState("");
  const [relProg, setRelProg] = useState<RelProg | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("reviewer");
  const [members, setMembers] = useState<any>(null);
  const [extForm, setExtForm] = useState({ design: "", population: "", intervention: "", outcomes: "", sampleSize: "", notes: "" });
  const [riskForm, setRiskForm] = useState({ selection: 0, performance: 0, detection: 0, attrition: 0, reporting: 0, overall: "", notes: "" });

  const loadMe = useCallback(async () => {
    const r = await fetch("/api/auth/me"); const j = await r.json();
    setMe(j.user || null); setPlan(j.plan || "free"); if (j.user) setReviewer(j.user.name);
  }, []);
  const loadProjects = useCallback(async () => {
    const r = await fetch("/api/projects"); if (!r.ok) return; const j = await r.json(); setProjects(j.projects || []);
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    const r = await fetch(`/api/projects/${id}`); if (!r.ok) return; setDetail(await r.json());
  }, []);
  const loadPayments = useCallback(async () => {
    const r = await fetch("/api/payments"); if (!r.ok) return; const j = await r.json(); setPayments(j.payments || []); setPayMode(j.mode || "");
  }, []);
  const loadRel = useCallback(async (id: string) => {
    const r = await fetch(`/api/projects/${id}/relevance`); if (!r.ok) return; setRelProg(await r.json());
  }, []);
  const loadMembers = useCallback(async (id: string) => {
    const r = await fetch(`/api/projects/${id}/invite`); if (!r.ok) return; setMembers(await r.json());
  }, []);
  useEffect(() => { loadMe(); }, [loadMe]);
  useEffect(() => { if (me) { loadProjects(); loadPayments(); } }, [me, loadProjects, loadPayments]);
  useEffect(() => { if (detail) { loadRel(detail.project.id); } }, [detail, loadRel]);

  async function auth(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const r = await fetch(`/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json(); if (!r.ok) { setMsg(j.error || "Gagal."); return; }
    await loadMe(); setMsg("Berhasil masuk. Selamat datang di Litara!");
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setMe(null); setDetail(null); setProjects([]); }
  async function createProject(e: React.FormEvent) {
    e.preventDefault(); const r = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newProj) });
    const j = await r.json(); if (!r.ok) { setMsg(j.error); return; } setNewProj({ title: "", researchQuestion: "", inclusion: "", exclusion: "" }); await loadProjects(); await loadDetail(j.project.id); setTab("screening");
  }

  // ---------- Screening ----------
  function stageVerdict(a: Article, st: string): string {
    if (st === "title_abstract" && a.consensus) return a.consensus;
    const vals = a.decisions.filter((d) => d.stage === st).map((d) => d.value);
    if (vals.includes("include")) return "include";
    if (vals.includes("exclude")) return "exclude";
    return vals.includes("maybe") ? "maybe" : "pending";
  }
  function myDecision(a: Article, st: string): Decision | undefined {
    return a.decisions.find((d) => d.stage === st && (d.reviewer === reviewer || d.reviewer === me?.name));
  }
  function stageList(): Article[] {
    if (!detail) return [];
    const arts = detail.project.articles;
    if (stage === "fulltext") return arts.filter((a) => stageVerdict(a, "title_abstract") === "include");
    if (stage === "extraction" || stage === "risk") return arts.filter((a) => stageVerdict(a, "fulltext") === "include");
    return arts;
  }
  function filtered() {
    const q = filter.toLowerCase();
    let list = stageList().filter((a) => !q || `${a.title} ${a.authors} ${a.abstract} ${a.journal} ${a.source} ${a.keywords || ""}`.toLowerCase().includes(q));
    if (srcFilter !== "all") list = list.filter((a) => a.source === srcFilter);
    if (decFilter !== "all") {
      if (decFilter === "conflict") list = list.filter((a) => detail!.prisma.conflictArticleIds.includes(a.id));
      else if (decFilter === "duplicate") list = list.filter((a) => a.duplicateOfId);
      else list = list.filter((a) => stageVerdict(a, stage === "extraction" || stage === "risk" ? "fulltext" : stage) === decFilter);
    }
    const sorted = [...list];
    if (sortMode === "learned") sorted.sort((x, y) => (y.learned ?? -1) - (x.learned ?? -1) || y.relevance - x.relevance);
    else if (sortMode === "relevance") sorted.sort((x, y) => y.relevance - x.relevance);
    return sorted;
  }
  const arts = filtered();
  const cur = arts.find((a) => a.id === selId) || arts[0] || null;
  const curIdx = cur ? arts.findIndex((a) => a.id === cur.id) : -1;

  async function decide(value: string) {
    if (!detail || !cur) return;
    const st = stage === "extraction" || stage === "risk" ? "fulltext" : stage;
    const body: any = { value, reviewer: reviewer || me?.name, stage: st };
    if (value === "exclude") body.reason = excludeReason;
    const r = await fetch(`/api/articles/${cur.id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { const j = await r.json(); setMsg(j.error || "Gagal menyimpan keputusan."); return; }
    await loadDetail(detail.project.id);
    const next = arts[curIdx + 1];
    if (next) setSelId(next.id);
  }
  const decideRef = useRef(decide); decideRef.current = decide;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (!detail || tab !== "screening") return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const k = e.key.toLowerCase();
      if (k === "i") decideRef.current("include");
      else if (k === "e") decideRef.current("exclude");
      else if (k === "m") decideRef.current("maybe");
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); const n = arts[curIdx + 1]; if (n) setSelId(n.id); }
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); const n = arts[curIdx - 1]; if (n) setSelId(n.id); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });

  // Isi formulir ekstraksi / RoB saat artikel terpilih berubah.
  useEffect(() => {
    if (!cur) return;
    const mine = cur.extractions.find((x) => x.reviewer === reviewer || x.reviewer === me?.name);
    setExtForm(mine ? { design: mine.design, population: mine.population, intervention: mine.intervention, outcomes: mine.outcomes, sampleSize: mine.sampleSize, notes: mine.notes } : { design: "", population: "", intervention: "", outcomes: "", sampleSize: "", notes: "" });
    const mr = cur.riskAssessments.find((x) => x.reviewer === reviewer || x.reviewer === me?.name);
    setRiskForm(mr ? { selection: mr.selection, performance: mr.performance, detection: mr.detection, attrition: mr.attrition, reporting: mr.reporting, overall: mr.overall, notes: mr.notes } : { selection: 0, performance: 0, detection: 0, attrition: 0, reporting: 0, overall: "", notes: "" });
    setLabelInput(cur.labels || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id]);

  async function saveExtraction() {
    if (!detail || !cur) return;
    const r = await fetch(`/api/articles/${cur.id}/extraction`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...extForm, reviewer: reviewer || me?.name }) });
    const j = await r.json(); setMsg(r.ok ? "Ekstraksi data tersimpan." : j.error); if (r.ok) await loadDetail(detail.project.id);
  }
  async function saveRisk() {
    if (!detail || !cur) return;
    const r = await fetch(`/api/articles/${cur.id}/risk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...riskForm, reviewer: reviewer || me?.name }) });
    const j = await r.json(); setMsg(r.ok ? "Penilaian Risk of Bias tersimpan." : j.error); if (r.ok) await loadDetail(detail.project.id);
  }
  async function saveLabels() {
    if (!detail || !cur) return;
    const r = await fetch(`/api/articles/${cur.id}/labels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labels: labelInput }) });
    if (r.ok) { await loadDetail(detail.project.id); setMsg("Label tersimpan."); }
  }
  async function toggleBlind() {
    if (!detail) return;
    const r = await fetch(`/api/projects/${detail.project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blindMode: !detail.project.blindMode }) });
    if (r.ok) await loadDetail(detail.project.id);
  }
  async function computeRelevance() {
    if (!detail) return;
    const r = await fetch(`/api/projects/${detail.project.id}/relevance`, { method: "POST" });
    const j = await r.json();
    setMsg(r.ok ? `Peringkat dihitung dari ${j.trained} keputusan — ${j.scored} artikel belum diputuskan diberi skor baru.` : j.error);
    if (r.ok) { await loadDetail(detail.project.id); await loadRel(detail.project.id); }
  }
  async function invite() {
    if (!detail) return;
    const r = await fetch(`/api/projects/${detail.project.id}/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
    const j = await r.json(); setMsg(r.ok ? `Berhasil mengundang ${j.member.name} sebagai ${j.member.role}.` : j.error);
    if (r.ok) { setInviteEmail(""); await loadMembers(detail.project.id); }
  }
  async function resolveConflict(articleId: string, value: string) {
    if (!detail) return;
    const r = await fetch(`/api/articles/${articleId}/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
    const j = await r.json(); setMsg(r.ok ? "Konsensus ditetapkan." : j.error); if (r.ok) await loadDetail(detail.project.id);
  }

  // ---------- Impor ----------
  async function onImportFile(file: File) {
    setImportName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const text = decodeImportFile(buf);
      setImportText(text);
      const parsed = parseImportDetailed(text, file.name);
      setImportDiag(parsed.diagnosis);
      setMsg(`Terbaca ${parsed.articles.length} referensi dari ${file.name} (pemisah: ${parsed.diagnosis.delimiterLabel}).`);
    } catch { setMsg("File tidak bisa dibaca. Coba simpan ulang sebagai CSV (UTF-8)."); }
  }
  async function doImport() {
    if (!detail) return;
    const r = await fetch(`/api/projects/${detail.project.id}/articles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: importText, filename: importName || "import.csv" }) });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error || "Impor gagal."); setImportDiag(j.diagnosis || null); return; }
    setMsg(`Berhasil impor ${j.imported} referensi${j.duplicates ? `, ${j.duplicates} duplikat` : ""}${j.skipped ? `, ${j.skipped} baris dilewati` : ""}.` + (j.skippedReasons?.length ? ` ${j.skippedReasons.slice(0, 3).join(" ")}` : ""));
    setImportDiag(j.diagnosis || null);
    if (r.ok) { setImportText(""); setImportName(""); await loadDetail(detail.project.id); }
  }
  async function checkout(planKey: string, method: string) {
    const r = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: planKey, method, yearly }) });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error); return; }
    if (j.redirectUrl) { window.open(j.redirectUrl, "_blank"); setMsg("Halaman pembayaran Midtrans Snap dibuka di tab baru."); }
    else { setMsg(`${j.note || ""} Pesanan ${j.payment.orderId} dibuat (Rp${j.payment.amount.toLocaleString("id-ID")}).`); }
    await loadPayments(); await loadMe();
  }
  async function confirmSim(orderId: string) {
    const r = await fetch("/api/payments/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
    const j = await r.json(); setMsg(j.note || j.error || "Dikonfirmasi."); await loadPayments(); await loadMe();
  }

  const decLabel = (v: string) => v === "include" ? "Include" : v === "exclude" ? "Exclude" : v === "maybe" ? "Maybe" : "Menunggu";
  const keywords = detail ? tokenize(detail.project.researchQuestion).filter((w) => w.length > 3) : [];
  function highlight(text: string) {
    if (!text || !keywords.length) return text;
    const parts = text.split(new RegExp(`(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi"));
    return (<>{parts.map((p, i) => keywords.some((k) => k.toLowerCase() === p.toLowerCase()) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>)}</>);
  }
  const sources = detail ? Array.from(new Set(detail.project.articles.map((a) => a.source))) : [];
  const canEdit = detail ? detail.role !== "viewer" : false;

  if (!me) return (
    <div>
      <header className="top"><Logo /><div><div style={{ fontSize: 22, fontWeight: 800 }}>Litara</div><div style={{ fontSize: 13, opacity: .9 }}>Solusi SLR Cerdas untuk Akademia Indonesia.</div></div></header>
      <div className="wrap">
        <div className="grid g2">
          <div className="card"><h1 style={{ marginTop: 0 }}>Systematic Literature Review, tanpa ribet.</h1><p>Import RIS / BibTeX / CSV dari Scopus, SINTA, Garuda, WoS, dan DOAJ. Screening Include / Exclude / Maybe, deteksi duplikat, blind review, dan diagram PRISMA 2020 yang terhitung otomatis.</p><p><span className="tag">Free</span> <span className="tag">Pro Rp79.000/bulan</span> <span className="tag">Institusi mulai Rp490.000/tim/bulan</span></p><p className="small">Daftar gratis — data tersimpan di server, bukan hanya di browser.</p></div>
          <div className="card">
            <div className="tabs"><button className={authMode === "login" ? "on" : ""} onClick={() => setAuthMode("login")}>Masuk</button><button className={authMode === "register" ? "on" : ""} onClick={() => setAuthMode("register")}>Daftar</button></div>
            <form onSubmit={auth} className="grid">
              {authMode === "register" && <input placeholder="Nama lengkap" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
              <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <input placeholder="Kata sandi (min. 6 karakter)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <button className="btn" type="submit">{authMode === "login" ? "Masuk ke Litara" : "Buat Akun Gratis"}</button>
            </form>
            {msg && <p>{msg}</p>}
            <p className="small">Akun demo (setelah <code>npm run db:seed</code>): demo@litara.id / demo1234</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <header className="top"><Logo /><div style={{ flex: 1 }}><div style={{ fontSize: 22, fontWeight: 800 }}>Litara</div><div style={{ fontSize: 13, opacity: .9 }}>Solusi SLR Cerdas untuk Akademia Indonesia.</div></div><span className="badge" style={{ background: "#fff", color: "#9c0c24" }}>Paket {plan}</span><span>{me.name}</span><button className="btn-ghost" onClick={logout}>Keluar</button></header>
      <div className="wrap">
        {msg && <div className="card" style={{ marginBottom: 16 }}>{msg}</div>}
        {!detail ? (
          <div className="grid">
            <div className="card"><h2 style={{ marginTop: 0 }}>Buat Proyek SLR Baru</h2><form onSubmit={createProject} className="grid">
              <input placeholder="Judul proyek — contoh: Pengaruh Pembelajaran Daring terhadap Hasil Belajar" value={newProj.title} onChange={(e) => setNewProj({ ...newProj, title: e.target.value })} required />
              <textarea placeholder="Pertanyaan riset" value={newProj.researchQuestion} onChange={(e) => setNewProj({ ...newProj, researchQuestion: e.target.value })} required rows={2} />
              <input placeholder="Kriteria inklusi" value={newProj.inclusion} onChange={(e) => setNewProj({ ...newProj, inclusion: e.target.value })} />
              <input placeholder="Kriteria eksklusi" value={newProj.exclusion} onChange={(e) => setNewProj({ ...newProj, exclusion: e.target.value })} />
              <button className="btn" type="submit">Buat Proyek</button></form>
              <p className="small">Paket {plan}: maks. {plan === "free" ? "1" : plan === "pro" ? "10" : "tak terbatas"} proyek. Blind Mode aktif secara default untuk proyek baru.</p></div>
            <div className="grid g3">{projects.map((p) => (
              <div key={p.id} className="card"><h3>{p.title}</h3><p className="small">{p.researchQuestion}</p><p>{p.total} referensi · {p.screened} disaring · {p.included} include</p><button className="btn" onClick={() => { loadDetail(p.id); setTab("screening"); }}>Buka Proyek</button></div>
            ))}</div>
            {projects.length === 0 && <p className="small">Belum ada proyek. Buat proyek pertama di atas, atau jalankan <code>npm run db:seed</code> untuk proyek contoh 16 artikel.</p>}
          </div>
        ) : (
          <div>
            <button className="btn-ghost" onClick={() => setDetail(null)}>← Semua Proyek</button>
            <h2>{detail.project.title}</h2><p className="small">{detail.project.researchQuestion} · Peran Anda: <b>{detail.role}</b>{detail.project.blindMode ? " · Blind Mode aktif" : " · Blind Mode nonaktif"}</p>
            <div className="tabs">{["screening", "tim", "semua", "prisma", "impor", "harga"].map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); if (t === "tim") loadMembers(detail.project.id); }}>{t === "screening" ? "Screening" : t === "tim" ? "Tim & Konflik" : t === "semua" ? "Semua Referensi" : t === "prisma" ? "PRISMA" : t === "impor" ? "Impor" : "Paket & Harga"}</button>)}</div>

            {tab === "screening" && (
              <div>
                <div className="tabs" style={{ marginTop: 0 }}>{STAGES.map((s) => <button key={s.key} className={stage === s.key ? "on" : ""} onClick={() => { setStage(s.key); setSelId(null); }}>{s.label}</button>)}</div>
                <div className="screen3">
                  {/* Kolom kiri: filter + peringkat + blind mode */}
                  <div className="card">
                    <input placeholder="Cari judul / penulis / abstrak…" value={filter} onChange={(e) => setFilter(e.target.value)} />
                    <div className="grid" style={{ marginTop: 10 }}>
                      <label className="small">Keputusan<select value={decFilter} onChange={(e) => setDecFilter(e.target.value)}><option value="all">Semua status</option><option value="pending">Belum diputuskan</option><option value="include">Include</option><option value="maybe">Maybe</option><option value="exclude">Exclude</option><option value="conflict">Konflik</option><option value="duplicate">Duplikat</option></select></label>
                      <label className="small">Sumber<select value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)}><option value="all">Semua sumber</option>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                      <label className="small">Urutkan<select value={sortMode} onChange={(e) => setSortMode(e.target.value)}><option value="learned">Peringkat relevansi terlatih</option><option value="relevance">Skor kata kunci</option><option value="newest">Urutan impor</option></select></label>
                      <label className="small">Reviewer<input value={reviewer} onChange={(e) => setReviewer(e.target.value)} /></label>
                    </div>
                    <div className="card" style={{ marginTop: 12, background: "#fff7f7" }}>
                      <b>Peringkat Relevansi</b>
                      {relProg ? (
                        <div>
                          <p className="small">Keputusan tahap Judul &amp; Abstrak: <b>{relProg.total}/{relProg.minTotal}</b> (Include {relProg.included}, Exclude {relProg.excluded})</p>
                          {relProg.ready ? (
                            <div><p className="small">Siap dihitung. {relProg.trainedAt ? `Terakhir dilatih: ${new Date(relProg.trainedAt).toLocaleDateString("id-ID")}.` : "Belum pernah dilatih."}</p><button className="btn" onClick={computeRelevance} disabled={!canEdit}>Hitung Peringkat</button></div>
                          ) : (
                            <p className="small"><b>Belum siap</b> — dibutuhkan {relProg.minTotal} keputusan (minimal {relProg.minEach} Include dan {relProg.minEach} Exclude) agar sistem bisa belajar dari pola keputusan tim.</p>
                          )}
                        </div>
                      ) : <p className="small">Memuat…</p>}
                    </div>
                    <label className="small" style={{ display: "block", marginTop: 12 }}><input type="checkbox" checked={detail.project.blindMode} onChange={toggleBlind} disabled={detail.role !== "owner" && detail.role !== "editor"} style={{ width: "auto" }} /> Blind Mode {detail.project.blindMode ? "aktif" : "nonaktif"}{detail.project.blindMode && <span> — keputusan reviewer lain disembunyikan</span>}</label>
                    <p className="small">Pintasan: <span className="kbd">I</span> Include <span className="kbd">E</span> Exclude <span className="kbd">M</span> Maybe · <span className="kbd">↑</span><span className="kbd">↓</span> pindah artikel</p>
                  </div>
                  {/* Kolom tengah: daftar artikel */}
                  <div className="card" style={{ padding: 8 }}>
                    <p className="small" style={{ padding: "0 8px" }}>{arts.length} artikel · tahap: {STAGES.find((s) => s.key === stage)?.label}</p>
                    <div className="artlist">
                      {arts.map((a) => {
                        const v = stageVerdict(a, stage === "extraction" || stage === "risk" ? "fulltext" : stage);
                        const isCur = cur?.id === a.id;
                        return (
                          <div key={a.id} onClick={() => setSelId(a.id)} className={isCur ? "artrow on" : "artrow"}>
                            <b>{a.title}</b>
                            <div className="small">{a.authors} · {a.year || ""} · {a.journal}</div>
                            <div><span className="tag">{a.source}</span> <span className="badge" style={{ background: "#fee2e2" }}>{a.learned != null ? `Terlatih ${a.learned}` : `Skor ${a.relevance}`}</span> {v === "include" && <span className="badge inc">Include</span>}{v === "exclude" && <span className="badge exc">Exclude</span>}{v === "maybe" && <span className="badge may">Maybe</span>}{a.duplicateOfId && <span className="badge exc">Duplikat</span>}{a.consensus && <span className="badge inc">Konsensus: {decLabel(a.consensus)}</span>}{detail.prisma.conflictArticleIds.includes(a.id) && <span className="badge may">Konflik</span>}</div>
                          </div>
                        );
                      })}
                      {arts.length === 0 && <p className="small" style={{ padding: 12 }}>{stage === "fulltext" ? "Belum ada artikel yang lolos tahap Judul & Abstrak." : stage === "extraction" || stage === "risk" ? "Belum ada artikel yang lolos tahap Teks Lengkap." : "Tidak ada artikel yang cocok. Coba tab Impor untuk menambah referensi."}</p>}
                    </div>
                  </div>
                  {/* Kolom kanan: detail + keputusan */}
                  <div className="card">
                    {cur ? (
                      <div>
                        <span className="tag">{cur.source} · {cur.year || ""}</span> {cur.duplicateOfId && <span className="badge exc">Duplikat</span>}
                        <h3 style={{ marginTop: 8 }}>{cur.title}</h3>
                        <p className="small">{cur.authors} · {cur.journal} · {cur.doi}</p>
                        <p>{cur.abstract ? highlight(cur.abstract) : <span className="small">Tidak ada abstrak pada file impor.</span>}</p>
                        {cur.keywords && <p className="small">Kata kunci: {cur.keywords}</p>}
                        <p>Keputusan tahap ini: <b>{cur.decisions.filter((d) => d.stage === (stage === "extraction" || stage === "risk" ? "fulltext" : stage)).map((d) => `${d.reviewer}: ${decLabel(d.value)}${d.reason ? ` (${d.reason})` : ""}`).join(" · ") || "Menunggu"}</b>{cur.consensus && <> · Konsensus: <b>{decLabel(cur.consensus)}</b></>}</p>
                        {(stage === "title_abstract" || stage === "fulltext") && canEdit && (
                          <div>
                            <label className="small">Alasan penolakan (untuk Exclude)<select value={excludeReason} onChange={(e) => setExcludeReason(e.target.value)}>{EXCLUDE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                              <button className="btn" onClick={() => decide("include")}>✓ Include (I)</button>
                              <button className="btn-ghost" onClick={() => decide("maybe")}>? Maybe (M)</button>
                              <button className="btn-ghost" onClick={() => decide("exclude")}>✕ Exclude (E)</button>
                            </div>
                            <p className="small">Keputusan disimpan pada tahap {stage === "fulltext" ? "Teks Lengkap" : "Judul & Abstrak"}.</p>
                          </div>
                        )}
                        <div style={{ marginTop: 12 }}>
                          <label className="small">Label (pisah koma)<div style={{ display: "flex", gap: 8 }}><input value={labelInput} onChange={(e) => setLabelInput(e.target.value)} placeholder="mis. metode kuantitatif, prioritas baca" /><button className="btn-ghost" onClick={saveLabels}>Simpan</button></div></label>
                        </div>
                        {stage === "extraction" && (
                          <div style={{ marginTop: 12 }}>
                            <h4>Ekstraksi Data</h4>
                            <div className="grid">
                              <input placeholder="Desain studi (mis. RCT, kohort, kualitatif)" value={extForm.design} onChange={(e) => setExtForm({ ...extForm, design: e.target.value })} />
                              <input placeholder="Ukuran sampel" value={extForm.sampleSize} onChange={(e) => setExtForm({ ...extForm, sampleSize: e.target.value })} />
                              <textarea placeholder="Populasi / partisipan" value={extForm.population} onChange={(e) => setExtForm({ ...extForm, population: e.target.value })} rows={2} />
                              <textarea placeholder="Intervensi" value={extForm.intervention} onChange={(e) => setExtForm({ ...extForm, intervention: e.target.value })} rows={2} />
                              <textarea placeholder="Hasil utama (outcomes)" value={extForm.outcomes} onChange={(e) => setExtForm({ ...extForm, outcomes: e.target.value })} rows={2} />
                              <textarea placeholder="Catatan" value={extForm.notes} onChange={(e) => setExtForm({ ...extForm, notes: e.target.value })} rows={2} />
                            </div>
                            {canEdit && <button className="btn" style={{ marginTop: 8 }} onClick={saveExtraction}>Simpan Ekstraksi</button>}
                            {cur.extractions.length > 0 && <p className="small">Sudah diekstraksi oleh: {cur.extractions.map((x) => x.reviewer).join(", ")}</p>}
                          </div>
                        )}
                        {stage === "risk" && (
                          <div style={{ marginTop: 12 }}>
                            <h4>Risk of Bias</h4>
                            <div className="grid">
                              {ROB_DOMAINS.map((d) => (
                                <label key={d.key} className="small">{d.label}<select value={riskForm[d.key]} onChange={(e) => setRiskForm({ ...riskForm, [d.key]: Number(e.target.value) })}>{ROB_LEVELS.map((l, i) => <option key={l} value={i}>{l}</option>)}</select></label>
                              ))}
                              <label className="small">Penilaian keseluruhan<select value={riskForm.overall} onChange={(e) => setRiskForm({ ...riskForm, overall: e.target.value })}><option value="">—</option><option value="Rendah">Rendah</option><option value="Sedang">Sedang</option><option value="Tinggi">Tinggi</option></select></label>
                              <textarea placeholder="Catatan penilaian" value={riskForm.notes} onChange={(e) => setRiskForm({ ...riskForm, notes: e.target.value })} rows={2} />
                            </div>
                            {canEdit && <button className="btn" style={{ marginTop: 8 }} onClick={saveRisk}>Simpan Penilaian</button>}
                            {cur.riskAssessments.length > 0 && <p className="small">Sudah dinilai oleh: {cur.riskAssessments.map((x) => `${x.reviewer} (${x.overall || "tanpa penilaian keseluruhan"})`).join(", ")}</p>}
                          </div>
                        )}
                      </div>
                    ) : <p>Tidak ada artikel yang dipilih.</p>}
                  </div>
                </div>
              </div>
            )}

            {tab === "tim" && (
              <div className="grid">
                <div className="card"><h3 style={{ marginTop: 0 }}>Tim Reviewer</h3>
                  <p className="small">Pemilik: <b>{members?.owner?.name || "—"}</b> ({members?.owner?.email || ""})</p>
                  {members ? (members.members.length ? <table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th></tr></thead><tbody>{members.members.map((m: any) => <tr key={m.id}><td>{m.name}</td><td>{m.email}</td><td>{m.role}</td></tr>)}</tbody></table> : <p className="small">Belum ada kolaborator yang diundang.</p>) : <p className="small">Memuat…</p>}
                  {canEdit && <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}><input style={{ flex: 2 }} placeholder="Email kolaborator (harus sudah daftar di Litara)" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /><select style={{ flex: 1 }} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}><option value="editor">Editor</option><option value="reviewer">Reviewer</option><option value="viewer">Pengamat</option></select><button className="btn" onClick={invite}>Undang</button></div>}
                  <p className="small">Editor: screening + ubah. Reviewer: screening. Pengamat: hanya melihat. Blind Mode {detail.project.blindMode ? "aktif — keputusan reviewer lain disembunyikan sampai mode dibuka" : "nonaktif — semua keputusan terlihat"}.</p>
                </div>
                <div className="card"><h3 style={{ marginTop: 0 }}>Konflik ({detail.prisma.conflicts})</h3>
                  {detail.prisma.conflicts === 0 ? <p className="small">Tidak ada konflik antar-reviewer saat ini.</p> : detail.project.articles.filter((a) => detail.prisma.conflictArticleIds.includes(a.id)).map((a) => (
                    <div key={a.id} style={{ borderTop: "1px solid #e5e7eb", padding: "10px 0" }}>
                      <b>{a.title}</b>
                      <p className="small">{a.decisions.filter((d) => d.stage === "title_abstract").map((d) => `${d.reviewer}: ${decLabel(d.value)}`).join(" · ")}{a.consensus ? ` · Konsensus: ${decLabel(a.consensus)}` : ""}</p>
                      {canEdit && <div style={{ display: "flex", gap: 8 }}><button className="btn" onClick={() => resolveConflict(a.id, "include")}>Konsensus: Include</button><button className="btn-ghost" onClick={() => resolveConflict(a.id, "exclude")}>Konsensus: Exclude</button>{a.consensus && <button className="btn-ghost" onClick={() => resolveConflict(a.id, "")}>Hapus Konsensus</button>}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "semua" && (<div className="card"><table><thead><tr><th>Judul</th><th>Sumber</th><th>Skor</th><th>Keputusan</th></tr></thead><tbody>{detail.project.articles.map((a) => <tr key={a.id}><td><b>{a.title}</b><br /><span className="small">{a.authors} · {a.journal}</span></td><td>{a.source}</td><td>{a.learned != null ? `Terlatih ${a.learned}` : a.relevance}</td><td>{a.decisions.map((d) => `${d.reviewer}: ${decLabel(d.value)} (${d.stage === "fulltext" ? "teks lengkap" : "judul/abstrak"})`).join(", ") || "Menunggu"}{a.duplicateOfId ? " · Duplikat" : ""}{a.consensus ? ` · Konsensus: ${decLabel(a.consensus)}` : ""}</td></tr>)}</tbody></table><p><a href={`/api/projects/${detail.project.id}/export?type=csv`}>Unduh CSV</a> · <a href={`/api/projects/${detail.project.id}/export?type=ris`}>Unduh RIS (Include)</a> · <a href={`/api/projects/${detail.project.id}/export?type=txt`}>Ringkasan PRISMA (TXT)</a></p><p className="small">Reviewer: {detail.project.reviewers.map((r) => r.name).join(", ")} · Konflik antar-reviewer: {detail.prisma.conflicts} artikel</p></div>)}

            {tab === "prisma" && (<div className="card"><h3>Diagram Alir PRISMA 2020</h3><p>Teridentifikasi: <b>{detail.prisma.identified}</b></p><p>Duplikat dibuang: <b>{detail.prisma.duplicatesRemoved}</b></p><p>Disaring (judul/abstrak): <b>{detail.prisma.screened}</b></p><p>Include tahap judul/abstrak: <b>{detail.prisma.included}</b> · Exclude: <b>{detail.prisma.excluded}</b> · Menunggu: <b>{detail.prisma.pending}</b></p><p>Dinilai teks lengkap: <b>{detail.prisma.fulltextAssessed}</b> · Include teks lengkap: <b>{detail.prisma.fulltextIncluded}</b> · Exclude teks lengkap: <b>{detail.prisma.fulltextExcluded}</b></p><p>Ekstraksi data selesai: <b>{detail.prisma.extracted}</b> artikel · Risk of Bias dinilai: <b>{detail.prisma.riskAssessed}</b> artikel</p><p>Konflik antar-reviewer: <b>{detail.prisma.conflicts}</b></p></div>)}

            {tab === "impor" && (<div className="card"><h3>Impor Referensi (RIS / BibTeX / CSV)</h3><p className="small">Semua format CSV diterima: koma, titik koma, tab, atau pipa; header Inggris/Indonesia (termasuk header Scopus seperti “Source title”); abstrak multi-baris ber-kutip; file tanpa header; UTF-8/UTF-16/Windows-1252. Duplikat terdeteksi otomatis berdasarkan DOI / judul. Baris bermasalah dilewati dan dilaporkan — tidak menggagalkan seluruh file.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <label className="btn" style={{ display: "inline-block" }}>Pilih File (.ris/.bib/.csv/.txt/.tsv)<input type="file" accept=".ris,.bib,.csv,.txt,.tsv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); }} /></label>
                <a className="btn-ghost" style={{ padding: "10px 16px", textDecoration: "none", display: "inline-block" }} href={`/api/projects/${detail.project.id}/export?type=sample`}>Unduh Contoh CSV</a>
                <button className="btn-ghost" onClick={() => setImportText(SAMPLE_RIS)}>Isi Contoh RIS</button>
              </div>
              {importName && <p className="small">File: <b>{importName}</b></p>}
              {importDiag && <div className="card" style={{ background: "#f8fafc", marginBottom: 8 }}><b>Diagnosis impor</b><p className="small">Format: {importDiag.format} · Pemisah terdeteksi: {importDiag.delimiterLabel || "-"} · Baris data: {importDiag.totalRows} · Terbaca: {importDiag.read} · Dilewati: {importDiag.skipped}</p>{importDiag.headers?.length > 0 && <p className="small">Kolom dikenali: {Object.entries(importDiag.headerMapped || {}).map(([h, f]) => `${h} → ${f}`).join(", ") || "—"}</p>}{importDiag.skippedReasons?.length > 0 && <p className="small">Alasan dilewati: {importDiag.skippedReasons.join(" ")}</p>}</div>}
              <textarea rows={8} value={importText} onChange={(e) => { setImportText(e.target.value); setImportName(""); }} placeholder={SAMPLE_RIS} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button className="btn" onClick={doImport}>Impor Referensi</button></div>
              <p className="small">Tips Scopus: saat export, centang kelompok <b>Abstract &amp; keywords</b> supaya kolom Abstract ikut ter-export — skor relevansi dan highlight PICO jadi lebih akurat.</p>
            </div>)}
            {tab === "harga" && (<Pricing plan={plan} yearly={yearly} setYearly={setYearly} checkout={checkout} payments={payments} payMode={payMode} confirmSim={confirmSim} />)}
          </div>
        )}
        {detail && tab !== "harga" && <p className="small" style={{ marginTop: 16 }}>Paket saat ini: {plan}. <button className="btn-ghost" onClick={() => setTab("harga")}>Lihat Paket & Harga</button></p>}
      </div>
    </div>
  );
}

function Pricing({ plan, yearly, setYearly, checkout, payments, payMode, confirmSim }: any) {
  return (<div className="grid">
    <div className="card"><label><input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} /> Tahunan (hemat 20%)</label><p className="small">Mode pembayaran saat ini: <b>{payMode === "midtrans" ? "Midtrans (live)" : "SIMULASI — MIDTRANS_SERVER_KEY belum dipasang, tidak ada tagihan nyata"}</b></p></div>
    <div className="grid g3">
      <div className="card"><h3>Free</h3><p><b>Rp0</b></p><p>1 proyek · 100 referensi · 1 reviewer · Screening dasar · Export CSV</p><p>Paket saat ini: {plan === "free" ? "Aktif" : "-"}</p></div>
      <div className="card" style={{ borderColor: "#c8102e" }}><h3>Pro</h3><p><b>{yearly ? "Rp63.200/bulan" : "Rp79.000/bulan"}</b></p><p className="small">{yearly ? "Ditagih Rp758.400/tahun" : "Ditagih bulanan"}</p><p>10 proyek · 5.000 referensi · Blind review · Deteksi konflik · Skor AI · Export RIS/PRISMA · Uji coba 14 hari</p><select id="pro-method" defaultValue="qris"><option value="qris">QRIS</option><option value="ewallet">E-wallet</option><option value="transfer">Transfer</option><option value="invoice">Invoice</option><option value="card">Kartu</option></select><button className="btn" style={{ marginTop: 8 }} onClick={() => checkout("pro", (document.getElementById("pro-method") as HTMLSelectElement)?.value || "qris")}>Pilih Pro</button></div>
      <div className="card"><h3>Institusi</h3><p><b>Mulai Rp490.000/tim/bulan</b></p><p>Proyek tak terbatas · Reviewer tak terbatas · Admin tim · Dukungan kampus · Invoice kampus</p><button className="btn-ghost" onClick={() => checkout("institusi", "invoice")}>Hubungi / Pilih Institusi</button></div>
    </div>
    <div className="card"><h3>Riwayat Pembayaran</h3>{payments.length === 0 ? <p className="small">Belum ada pembayaran.</p> : <table><thead><tr><th>Order</th><th>Paket</th><th>Jumlah</th><th>Metode</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{payments.map((p: any) => <tr key={p.id}><td className="mono">{p.orderId}</td><td>{p.plan}</td><td>Rp{p.amount.toLocaleString("id-ID")}</td><td>{p.method}</td><td>{p.status === "paid" ? "Lunas" : p.status === "failed" ? "Gagal" : "Menunggu"}{p.mode === "simulasi" ? " (simulasi)" : ""}</td><td>{p.status === "pending" && p.mode === "simulasi" ? <button className="btn-ghost" onClick={() => confirmSim(p.orderId)}>Konfirmasi Simulasi</button> : ""}</td></tr>)}</tbody></table>}</div>
  </div>);
}
