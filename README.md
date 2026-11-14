# Litara — Solusi SLR Cerdas untuk Akademia Indonesia

Platform Systematic Literature Review (SLR) untuk peneliti Indonesia:
import RIS / BibTeX / CSV, deteksi duplikat, screening Include / Exclude / Maybe,
blind review, deteksi konflik, diagram PRISMA 2020, dan paket SaaS
Free / Pro / Institusi dengan pembayaran Midtrans.

**Alur kerja 5 tahap (ala Rayyan):** Judul & Abstrak → Teks Lengkap →
Ekstraksi Data → Risk of Bias → PRISMA, dengan ruang kerja screening 3 kolom
(filter, daftar artikel, detail + abstrak), shortcut keyboard I/E/M/↑↓,
Blind Mode aktif default, dan Peringkat Relevansi yang belajar dari keputusan
tim (Naive Bayes; aktif setelah 50 keputusan tahap Judul & Abstrak, minimal
5 Include + 5 Exclude). Impor CSV menerima semua format: koma/titik koma/tab/
pipa, header Inggris/Indonesia (termasuk header Scopus), abstrak multi-baris
ber-kutip, file tanpa header, dan encoding UTF-8/UTF-16/Windows-1252 — baris
bermasalah dilewati dan dilaporkan, bukan menggagalkan seluruh file.

- **Pro:** Rp79.000/bulan atau Rp63.200/bulan tahunan (Rp758.400/tahun)
- **Institusi:** mulai Rp490.000/tim/bulan · Uji coba Pro 14 hari
- **Login:** email + kata sandi (hash scrypt), sesi server 30 hari
- **Midtrans:** Snap aktif otomatis saat `MIDTRANS_SERVER_KEY` dipasang;
  tanpa kunci, checkout berjalan dalam **mode simulasi yang diberi label jelas**
  dan tidak ada tagihan nyata.

## Teknologi

Next.js 14 (App Router, TypeScript) + Prisma + PostgreSQL.
Database: gunakan Postgres hosted (Neon / Supabase) lewat `DATABASE_URL`.

## Jalankan lokal

```bash
npm install
cp .env.example .env.local
# Isi DATABASE_URL dengan Postgres hosted (Neon/Supabase) dan SESSION_SECRET acak.
# Tanpa Postgres lokal: buat database gratis di Neon (neon.tech) atau Supabase,
# lalu salin connection string-nya ke DATABASE_URL.
npx prisma db push             # JANGAN pakai `prisma migrate deploy` — repo ini belum punya folder prisma/migrations/, jadi perintah itu tidak membuat tabel apa pun
npm run db:seed             # opsional: proyek contoh 16 artikel
npm run dev                 # http://localhost:3000
```

Akun demo setelah seed: `demo@litara.id` / `demo1234`

## Push ke GitHub

```bash
cd litara
git init
git add .
git commit -m "Litara v1: SLR SaaS fullstack (login, screening, PRISMA, Midtrans)"
# Buat repo kosong di github.com (misal: litara) — JANGAN centang README/.gitignore di GitHub
git remote add origin https://github.com/NAMA-USER/litara.git
git branch -M main
git push -u origin main
```

> Jangan pernah commit `.env`, `.env.local`, atau kunci Midtrans / database.
> File-file itu sudah ada di `.gitignore`. Yang aman di-commit hanya `.env.example`.

## Deploy di Vercel

1. Buka vercel.com → **Add New → Project** → **Import** repo `litara` dari GitHub.
2. Framework: Next.js (terdeteksi otomatis). Build Command: `npx prisma db push && npm run build` — ini yang membuat tabel database otomatis saat deploy, jadi tidak perlu terminal. Jangan biarkan di `npm run build` saja, tabel tidak akan dibuat dan login/daftar akan gagal.
3. Di **Settings → Environment Variables**, isi:

- `DATABASE_URL` — connection string Postgres (Neon/Supabase)
- `SESSION_SECRET` — string acak panjang (mis. `openssl rand -hex 32`)
- `MIDTRANS_SERVER_KEY` — dari dashboard Midtrans (kosongkan = mode simulasi)
- `MIDTRANS_CLIENT_KEY` — dari dashboard Midtrans (opsional, untuk Snap.js)
- `MIDTRANS_IS_PRODUCTION` — `false` (sandbox) / `true` (produksi)
- `NEXT_PUBLIC_APP_URL` — URL Vercel kamu, mis. `https://litara.vercel.app`

4. **Deploy.** Dengan Build Command di langkah 2, tabel database dibuat otomatis saat deploy — tidak ada langkah terminal. (Hanya kalau kamu terlanjur deploy dengan Build Command `npm run build`, jalankan sekali dari terminal `npx prisma db push` dengan connection string **langsung/direct, tanpa `-pooler`**, lalu Redeploy di Vercel.)

   Perintah cadangannya (hanya untuk kasus di atas):

```bash
DATABASE_URL="postgresql://user:password@host:5432/litara?sslmode=require" npx prisma db push
```

   Pakai connection string **langsung (direct, tanpa `-pooler`)** dari Neon/Supabase
   untuk perintah ini; connection string pooler bisa gagal saat membuat tabel.
   (Jangan jalankan `prisma migrate dev` di produksi.)

5. Uji: daftar akun → buat proyek → impor RIS contoh → screening → checkout Pro.
   Tanpa `MIDTRANS_SERVER_KEY`, checkout berlabel **SIMULASI** dan tidak menagih.

## Webhook Midtrans

Di dashboard Midtrans, arahkan Payment Notification URL ke:

```
https://DOMAIN-KAMU/api/webhooks/midtrans
```

Webhook memverifikasi signature SHA512 (`order_id + status_code + gross_amount + ServerKey`)
sebelum mengubah status pembayaran menjadi Lunas / Gagal dan mengaktifkan paket.

## Struktur

```
prisma/schema.prisma      # User, Session, Project (+blindMode, members), Article (+learned, consensus), Decision (per tahap), Extraction, RiskAssessment, ProjectMember, RelevanceModel, Subscription, Payment
prisma/seed.ts            # Proyek contoh: 16 artikel (Scopus, SINTA, Garuda, WoS, DOAJ)
src/lib/prisma.ts         # Prisma client + definisi paket
src/lib/auth.ts           # Hash scrypt, sesi 30 hari, cookie httpOnly
src/lib/access.ts         # Akses proyek: pemilik / editor / reviewer / pengamat
src/lib/slr.ts            # Parser RIS/BibTeX/CSV (RFC 4180), skor relevansi, Naive Bayes, deteksi duplikat
src/lib/midtrans.ts       # Snap order, verifikasi signature, cek status
src/app/page.tsx          # Landing, login/daftar, dashboard, screening 3 kolom, Tim, PRISMA, impor, harga
src/app/api/auth/*        # register, login, logout, me
src/app/api/projects/*    # CRUD proyek, impor artikel, export CSV/RIS/TXT, undang tim, peringkat relevansi
src/app/api/articles/*/decision  # Keputusan screening per reviewer & per tahap
src/app/api/articles/*/extraction # Formulir ekstraksi data per studi
src/app/api/articles/*/risk      # Penilaian Risk of Bias (5 domain)
src/app/api/articles/*/resolve   # Keputusan konsensus untuk konflik
src/app/api/payments/*    # Buat pesanan, konfirmasi simulasi
src/app/api/webhooks/midtrans   # Webhook Midtrans
```

## Yang masih simulasi

- **Midtrans tanpa kunci:** checkout membuat pesanan dengan mode `simulasi`,
  tanpa redirect Snap dan tanpa tagihan. Pasang `MIDTRANS_SERVER_KEY`
  (sandbox dulu) untuk transaksi nyata.
- **Skor relevansi AI:** dua lapis — skor kata kunci pertanyaan riset untuk
  artikel baru, dan Peringkat Relevansi Naive Bayes yang dilatih dari
  keputusan screening tim sendiri (aktif setelah 50 keputusan, minimal
  5 Include + 5 Exclude). Bukan LLM; bisa diganti model embedding/LLM nanti
  tanpa mengubah skema data.