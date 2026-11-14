"use client";
import { useEffect, useState, useCallback } from "react";
import Logo from "@/components/Logo";

type Me = { id: string; name: string; email: string } | null;
type Article = { id: string; title: string; authors: string; year?: number; journal: string; source: string; doi: string; abstract: string; relevance: number; duplicateOfId?: string | null; decisions: { reviewer: string; value: string; reason?: string }[] };
type Project = { id: string; title: string; researchQuestion: string; inclusion: string; exclusion: string; total: number; screened: number; included: number; createdAt: string };
type Detail = { project: { id: string; title: string; researchQuestion: string; inclusion: string; exclusion: string; articles: Article[]; reviewers: { name: string }[] }; prisma: { identified: number; duplicatesRemoved: number; screened: number; included: number; excluded: number; pending: number; conflicts: number } };

const SAMPLE_RIS = `TY  - JOUR\nTI  - Pembelajaran Daring dan Hasil Belajar Mahasiswa Indonesia\nAU  - Sari, Dewi\nY1  - 2024\nJO  - Jurnal Pendidikan Indonesia\nDO  - 10.1234/contoh.2024.01\nAB  - Tinjauan sistematis tentang pembelajaran daring dan hasil belajar mahasiswa.\nER  - \nTY  - JOUR\nTI  - Blended Learning dan Motivasi Belajar\nAU  - Putri, Maya\nY1  - 2023\nJO  - Jurnal Teknologi Pendidikan\nER  - `;

export default function Home() {
  const [me, setMe] = useState<Me>(null);
  const [plan, setPlan] = useState("free");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState("screening");
  const [idx, setIdx] = useState(0);
  const [filter, setFilter] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [newProj, setNewProj] = useState({ title: "", researchQuestion: "", inclusion: "", exclusion: "" });
  const [importText, setImportText] = useState("");
  const [payments, setPayments] = useState<any[]>([]);
  const [payMode, setPayMode] = useState("");
  const [yearly, setYearly] = useState(false);

  const loadMe = useCallback(async () => {
    const r = await fetch("/api/auth/me"); const j = await r.json();
    setMe(j.user || null); setPlan(j.plan || "free"); if (j.user) setReviewer(j.user.name);
  }, []);
  const loadProjects = useCallback(async () => {
    const r = await fetch("/api/projects"); if (!r.ok) return; const j = await r.json(); setProjects(j.projects || []);
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    const r = await fetch(`/api/projects/${id}`); if (!r.ok) return; setDetail(await r.json()); setIdx(0);
  }, []);
  const loadPayments = useCallback(async () => {
    const r = await fetch("/api/payments"); if (!r.ok) return; const j = await r.json(); setPayments(j.payments || []); setPayMode(j.mode || "");
  }, []);
  useEffect(() => { loadMe(); }, [loadMe]);
  useEffect(() => { if (me) { loadProjects(); loadPayments(); } }, [me, loadProjects, loadPayments]);

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
  async function decide(value: string) {
    if (!detail) return; const a = filtered()[idx]; if (!a) return;
    const r = await fetch(`/api/articles/${a.id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value, reviewer: reviewer || me?.name }) });
    if (r.ok) { await loadDetail(detail.project.id); setIdx((i) => i + 1); }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!detail || tab !== "screening") return;
      if (e.key.toLowerCase() === "i") decide("include");
      if (e.key.toLowerCase() === "e") decide("exclude");
      if (e.key.toLowerCase() === "m") decide("maybe");
      if (e.key === "ArrowRight") setIdx((i) => i + 1);
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });
  function filtered() {
    if (!detail) return [];
    const q = filter.toLowerCase();
    return detail.project.articles.filter((a) => !q || `${a.title} ${a.authors} ${a.abstract} ${a.journal} ${a.source}`.toLowerCase().includes(q));
  }
  async function doImport() {
    if (!detail) return; const r = await fetch(`/api/projects/${detail.project.id}/articles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: importText, filename: "import.ris" }) });
    const j = await r.json(); setMsg(r.ok ? `Berhasil impor ${j.imported} referensi, ${j.duplicates} duplikat terdeteksi.` : j.error); if (r.ok) { setImportText(""); await loadDetail(detail.project.id); }
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

  const arts = filtered(); const cur = arts[idx];
  const decLabel = (v: string) => v === "include" ? "Include" : v === "exclude" ? "Exclude" : v === "maybe" ? "Maybe" : "Menunggu";

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
              <p className="small">Paket {plan}: maks. {plan === "free" ? "1" : plan === "pro" ? "10" : "tak terbatas"} proyek.</p></div>
            <div className="grid g3">{projects.map((p) => (
              <div key={p.id} className="card"><h3>{p.title}</h3><p className="small">{p.researchQuestion}</p><p>{p.total} referensi · {p.screened} disaring · {p.included} include</p><button className="btn" onClick={() => { loadDetail(p.id); setTab("screening"); }}>Buka Proyek</button></div>
            ))}</div>
            {projects.length === 0 && <p className="small">Belum ada proyek. Buat proyek pertama di atas, atau jalankan <code>npm run db:seed</code> untuk proyek contoh 16 artikel.</p>}
          </div>
        ) : (
          <div>
            <button className="btn-ghost" onClick={() => setDetail(null)}>← Semua Proyek</button>
            <h2>{detail.project.title}</h2><p className="small">{detail.project.researchQuestion}</p>
            <div className="tabs">{["screening", "semua", "prisma", "impor", "harga"].map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t === "screening" ? "Screening" : t === "semua" ? "Semua Referensi" : t === "prisma" ? "PRISMA" : t === "impor" ? "Impor" : "Paket & Harga"}</button>)}</div>
            {tab === "screening" && (
              <div className="grid">
                <div className="card"><input placeholder="Cari judul / penulis / abstrak…" value={filter} onChange={(e) => { setFilter(e.target.value); setIdx(0); }} /><p className="small">Reviewer: <input style={{ width: 200 }} value={reviewer} onChange={(e) => setReviewer(e.target.value)} /> · Artikel {arts.length ? idx + 1 : 0} / {arts.length} · Pintasan: <span className="kbd">I</span> Include <span className="kbd">E</span> Exclude <span className="kbd">M</span> Maybe</p></div>
                {cur ? (<div className="card"><span className="tag">{cur.source} · {cur.year || ""}</span> {cur.duplicateOfId && <span className="badge exc">Duplikat</span>} <span className="badge" style={{ background: "#fee2e2" }}>Skor relevansi {cur.relevance}</span><h3>{cur.title}</h3><p className="small">{cur.authors} · {cur.journal} · {cur.doi}</p><p>{cur.abstract}</p><p>Keputusan: <b>{cur.decisions.map((d) => `${d.reviewer}: ${decLabel(d.value)}`).join(" · ") || "Menunggu"}</b></p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn" onClick={() => decide("include")}>✓ Include (I)</button><button className="btn-ghost" onClick={() => decide("maybe")}>? Maybe (M)</button><button className="btn-ghost" onClick={() => decide("exclude")}>✕ Exclude (E)</button></div></div>) : <div className="card">Tidak ada artikel yang cocok. Coba tab Impor untuk menambah referensi.</div>}
              </div>
            )}
            {tab === "semua" && (<div className="card"><table><thead><tr><th>Judul</th><th>Sumber</th><th>Skor</th><th>Keputusan</th></tr></thead><tbody>{detail.project.articles.map((a) => <tr key={a.id}><td><b>{a.title}</b><br /><span className="small">{a.authors} · {a.journal}</span></td><td>{a.source}</td><td>{a.relevance}</td><td>{a.decisions.map((d) => `${d.reviewer}: ${decLabel(d.value)}`).join(", ") || "Menunggu"}{a.duplicateOfId ? " · Duplikat" : ""}</td></tr>)}</tbody></table><p><a href={`/api/projects/${detail.project.id}/export?type=csv`}>Unduh CSV</a> · <a href={`/api/projects/${detail.project.id}/export?type=ris`}>Unduh RIS (Include)</a> · <a href={`/api/projects/${detail.project.id}/export?type=txt`}>Ringkasan PRISMA (TXT)</a></p><p className="small">Reviewer: {detail.project.reviewers.map((r) => r.name).join(", ")} · Konflik antar-reviewer: {detail.prisma.conflicts} artikel</p></div>)}
            {tab === "prisma" && (<div className="card"><h3>Diagram Alir PRISMA 2020</h3><p>Teridentifikasi: <b>{detail.prisma.identified}</b></p><p>Duplikat dibuang: <b>{detail.prisma.duplicatesRemoved}</b></p><p>Disaring (judul/abstrak): <b>{detail.prisma.screened}</b></p><p>Include: <b>{detail.prisma.included}</b> · Exclude: <b>{detail.prisma.excluded}</b> · Menunggu: <b>{detail.prisma.pending}</b></p><p>Konflik antar-reviewer: <b>{detail.prisma.conflicts}</b></p></div>)}
            {tab === "impor" && (<div className="card"><h3>Impor Referensi (RIS / BibTeX / CSV)</h3><p className="small">Tempel isi file di bawah ini. Duplikat terdeteksi otomatis berdasarkan DOI / judul, dan skor relevansi dihitung dari kata kunci pertanyaan riset.</p><textarea rows={8} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={SAMPLE_RIS} /><div style={{ display: "flex", gap: 8, marginTop: 8 }}><button className="btn" onClick={doImport}>Impor Referensi</button><button className="btn-ghost" onClick={() => setImportText(SAMPLE_RIS)}>Isi Contoh RIS</button></div></div>)}
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
