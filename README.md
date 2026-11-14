# Litara — Solusi SLR Cerdas untuk Akademia Indonesia

Platform Systematic Literature Review (SLR) untuk peneliti Indonesia:
import RIS / BibTeX / CSV, deteksi duplikat, screening Include / Exclude / Maybe,
blind review, deteksi konflik, diagram PRISMA 2020, dan paket SaaS
Free / Pro / Institusi dengan pembayaran Midtrans.

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
npx prisma migrate deploy   # atau: npx prisma db push
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
2. Framework: Next.js (terdeteksi otomatis). Build Command: `npm run build`.
3. Di **Settings → Environment Variables**, isi:

- `DATABASE_URL` — connection string Postgres (Neon/Supabase)
- `SESSION_SECRET` — string acak panjang (mis. `openssl rand -hex 32`)
- `MIDTRANS_SERVER_KEY` — dari dashboard Midtrans (kosongkan = mode simulasi)
- `MIDTRANS_CLIENT_KEY` — dari dashboard Midtrans (opsional, untuk Snap.js)
- `MIDTRANS_IS_PRODUCTION` — `false` (sandbox) / `true` (produksi)
- `NEXT_PUBLIC_APP_URL` — URL Vercel kamu, mis. `https://litara.vercel.app`

4. **Deploy.** Setelah deploy pertama, buat tabel database sekali — pakai
`db push`, BUKAN `migrate deploy`, karena repo ini belum punya folder
`prisma/migrations/` (jadi `migrate deploy` tidak akan membuat tabel apa pun):

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
prisma/schema.prisma      # User, Session, Project, Article, Decision, Subscription, Payment
prisma/seed.ts            # Proyek contoh: 16 artikel (Scopus, SINTA, Garuda, WoS, DOAJ)
src/lib/prisma.ts         # Prisma client + definisi paket
src/lib/auth.ts           # Hash scrypt, sesi 30 hari, cookie httpOnly
src/lib/slr.ts            # Parser RIS/BibTeX/CSV, skor relevansi, deteksi duplikat
src/lib/midtrans.ts       # Snap order, verifikasi signature, cek status
src/app/page.tsx          # Landing, login/daftar, dashboard, screening, PRISMA, harga
src/app/api/auth/*        # register, login, logout, me
src/app/api/projects/*    # CRUD proyek, impor artikel, export CSV/RIS/TXT
src/app/api/articles/*/decision  # Keputusan screening per reviewer
src/app/api/payments/*    # Buat pesanan, konfirmasi simulasi
src/app/api/webhooks/midtrans   # Webhook Midtrans
```

## Yang masih simulasi

- **Midtrans tanpa kunci:** checkout membuat pesanan dengan mode `simulasi`,
  tanpa redirect Snap dan tanpa tagihan. Pasang `MIDTRANS_SERVER_KEY`
  (sandbox dulu) untuk transaksi nyata.
- **Skor relevansi AI:** berbasis kata kunci pertanyaan riset (bukan LLM).
  Bisa diganti model embedding/LLM nanti tanpa mengubah skema data.