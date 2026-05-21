# Nonahau Stock

Sistem web minimalis untuk pencatatan stok dimsum (barang jadi) di Dimsum Nonahau.

## Fitur (MVP)
- Login (Supabase Auth)
- Master produk (tambah/rename/nonaktif)
- Master kategori (tambah/rename/nonaktif) + inline create dari form transaksi
- Transaksi stok:
  - `IN` (stok masuk)
  - `OUT` (stok keluar) — divalidasi agar tidak melebihi stok saat ini
  - `ADJUST`:
    - `CORRECTION` (koreksi) — dibatasi max 2 hari sejak transaksi asal dicatat
    - `OPNAME` (opname) — single & bulk
- Dashboard:
  - Grafik IN vs OUT (harian/bulanan/tahunan), default 7 hari terakhir
  - Filter per produk
  - Tabel stok saat ini
- Riwayat transaksi + edit metadata (max 2 hari sejak dicatat)
- Export CSV (default: IN/OUT)

## Setup

### 1) Supabase
1. Buat project di Supabase
2. Jalankan SQL:
   - `supabase/schema.sql`
   - (opsional) `supabase/seed.sql`
3. Buat akun user (manager/admin) di Supabase Auth

### 2) Environment variables
Buat file `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Lihat contoh di `.env.example`.

### 3) Jalankan lokal
```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Catatan implementasi
- Operasi transaksi stok dilakukan via RPC Supabase untuk menjaga validasi stok dan aturan 2 hari.
- Detail pemanggilan RPC ada di `supabase/contract.md` dan `supabase/nextjs-usage.md`.
