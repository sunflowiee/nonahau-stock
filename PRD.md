# PRD — Sistem Pencatatan & Pendataan Stok (Web)

**Project name:** Dimsum Nonahau — Stock System  
**Document:** `PRD.md`  
**Owner:** Dimsum Nonahau  
**Platform:** Web (Next.js Fullstack)  
**Database/Auth:** Supabase (Postgres + Auth)  
**UI:** shadcn/ui + Tailwind  
**Deployment:** Vercel  
**Timezone:** WIB (UI), data disimpan `timestamptz`

---

## 1. Latar belakang & tujuan
Dimsum Nonahau membutuhkan sistem web sederhana namun akurat untuk:
- Mencatat **stok masuk (IN)** dan **stok keluar (OUT)** untuk barang jadi (dimsum).
- Memantau tren **IN vs OUT** melalui grafik harian/bulanan/tahunan.
- Menjaga stok tetap konsisten (tidak minus) dan mudah diaudit.
- Mendukung realita operasional: kadang ada keterlambatan pencatatan, sehingga dibutuhkan mekanisme **koreksi/opname** yang jelas.

---

## 2. Ruang lingkup (Scope)

### 2.1 In scope
- Pencatatan stok **barang jadi** (produk dimsum) saja.
- Satuan stok **selalu pcs**.
- **Satu lokasi** (tidak ada multi-gudang).
- Master data produk (tambah/edit/nonaktif).
- Pencatatan transaksi:
  - `IN` (stok masuk)
  - `OUT` (stok keluar)
  - `ADJUST` (koreksi dan stock opname; bisa + atau -)
- Kategori transaksi:
  - **Dinamis**: user dapat menambah kategori langsung dari form (inline create).
- Deskripsi bebas untuk konteks transaksi.
- Dashboard:
  - Grafik **IN vs OUT** per **hari/bulan/tahun**.
  - Default grafik **gabungan semua produk**, tersedia filter per produk.
  - **ADJUST tidak ditampilkan di grafik**.
- Riwayat transaksi (filter & export CSV).
- Aturan edit/koreksi dibatasi waktu (**maksimal 2 hari**) berdasarkan `created_at`.

### 2.2 Out of scope (versi ini)
- Bahan baku/WIP.
- Tracking batch/lot/expired.
- Multi lokasi gudang.
- Barcode/QR.
- Role/hak akses kompleks (saat ini satu role saja).
- Akuntansi/costing.

---

## 3. Definisi & istilah
- **Produk**: satu jenis dimsum (mis. Hakau, Siomay Ayam). Kemasan tidak membedakan produk.
- **PCS**: satuan penyimpanan stok di aplikasi.
- **Movement/Mutasi**: baris transaksi yang mengubah stok (`IN`, `OUT`, `ADJUST`).
- **Koreksi (ADJUST: CORRECTION)**: transaksi penyesuaian stok (+/-) untuk memperbaiki kesalahan catat.
- **Opname (ADJUST: OPNAME)**: transaksi penyesuaian stok (+/-) yang dihasilkan dari stock opname (fisik vs sistem).

---

## 4. Persona & pengguna
- **User (Manager/Admin)**: satu role.
  - Mengelola produk.
  - Mencatat IN/OUT.
  - Melakukan koreksi dan stock opname.
  - Melihat dashboard, laporan, dan export CSV.

Catatan: Staff operasional tidak memakai aplikasi; mereka hanya melaporkan jumlah IN/OUT ke manager/admin.

---

## 5. Kebutuhan fungsional (Functional Requirements)

### 5.1 Autentikasi
- Login menggunakan Supabase Auth.
- Semua user authenticated memiliki akses yang sama (role tunggal).

### 5.2 Master Produk
- Tambah produk (nama unik).
- Edit nama produk.
- Nonaktifkan produk (agar tidak dipakai input baru, tetapi histori tetap ada).
- List produk aktif/nonaktif.

### 5.3 Master Kategori (inline)
- Kategori dipilih saat input transaksi.
- User dapat membuat kategori baru dari form input (inline create).
- Kategori bisa dinonaktifkan (opsional untuk MVP; minimal harus bisa dibuat).

### 5.4 Input transaksi: Stock In (IN)
Field:
- `movement_at` (datetime; default now, bisa dipilih/backdate)
- `product`
- `qty_pcs` (integer > 0)
- `category`
- `description` (opsional)

Efek:
- Menambah stok produk.

### 5.5 Input transaksi: Stock Out (OUT)
Field sama dengan IN.

Validasi:
- `qty_pcs` **tidak boleh melebihi stok saat ini**.

Efek:
- Mengurangi stok produk.

### 5.6 Koreksi Stok (ADJUST: CORRECTION)
Tujuan: memperbaiki kesalahan pencatatan IN/OUT tanpa mengubah qty transaksi asal.

Field:
- `movement_at` (default now)
- `product`
- `adjust_delta_pcs` (bisa + atau -; UI input bisa “+pcs/-pcs”)
- `category` (default “Koreksi” bila ada)
- `description` (wajib; harus menjelaskan alasan)
- `correction_for_movement_id` (wajib; memilih transaksi asal yang dikoreksi)

Validasi:
- Koreksi **hanya boleh dilakukan sebelum 2 hari** sejak transaksi asal dicatat.
  - Patokan: `now() <= origin.created_at + 2 days`
- Jika `adjust_delta_pcs` negatif, stok setelah koreksi tidak boleh < 0.

Efek:
- Menyesuaikan stok +/−.

### 5.7 Stock Opname (ADJUST: OPNAME)
Tujuan: menyamakan stok sistem dengan stok fisik.

Mode:
1) **Single-product opname**
   - input `qty_fisik_pcs`
   - sistem hitung selisih = fisik − stok_sistem
   - sistem membuat `ADJUST (OPNAME)` jika selisih ≠ 0

2) **Bulk opname (table)**
   - tampilkan semua produk aktif
   - user isi `qty_fisik_pcs` per produk
   - submit sekali

Validasi:
- `qty_fisik_pcs` integer ≥ 0.
- ADJUST yang dihasilkan tidak boleh membuat stok < 0 (secara definisi opname menghasilkan stok = fisik, jadi ini aman jika fisik ≥ 0).

Catatan:
- Opname **tidak dibatasi 2 hari**.

### 5.8 Riwayat transaksi (Movements)
- List transaksi dengan filter:
  - range tanggal
  - produk
  - type (IN/OUT/ADJUST)
  - kategori
- Menampilkan minimal:
  - waktu transaksi (`movement_at`)
  - produk
  - type
  - qty (untuk ADJUST tampilkan signed qty)
  - kategori
  - deskripsi
  - `created_at`, `created_by`
  - `updated_at`, `updated_by`

### 5.9 Edit transaksi (metadata-only, dibatasi 2 hari)
Aturan edit berlaku untuk semua transaksi:
- Semua edit hanya diperbolehkan sebelum 2 hari sejak transaksi dicatat.
  - Patokan: `now() <= movement.created_at + 2 days`

Khusus transaksi IN/OUT:
- **Boleh diubah:**
  - `movement_at`
  - `category`
  - `description`
- **Tidak boleh diubah:**
  - `type`
  - `product_id`
  - `qty_pcs`

Khusus transaksi ADJUST:
- Versi MVP: **metadata-only** juga (konsisten dengan aturan “semua edit hanya sebelum 2 hari”).

Audit:
- Simpan `updated_by`, `updated_at`.
- (Recommended) simpan snapshot before/after ke tabel audit.

### 5.10 Dashboard & grafik
- Grafik utama: **IN vs OUT**.
- Dimensi waktu:
  - Harian (group per hari)
  - Bulanan (group per bulan)
  - Tahunan (group per tahun)
- Default: semua produk (total).
- Filter: per produk.
- ADJUST **tidak masuk** perhitungan grafik.

Tambahan dashboard:
- Tabel stok saat ini per produk.

### 5.11 Export CSV
- Export CSV dari halaman riwayat.
- Export mengikuti filter yang sedang dipakai.

Kolom CSV (minimum):
- `movement_at`
- `product_name`
- `type`
- `qty_pcs` (untuk ADJUST disarankan tampil signed qty)
- `category`
- `description`
- `created_at`
- `updated_at`

---

## 6. Kebutuhan non-fungsional (Non-Functional Requirements)
- **Konsistensi stok:** validasi OUT harus atomik (hindari race condition). Implementasi disarankan lewat RPC Postgres.
- **Performa:** mampu menangani total transaksi harian > 100.
- **Auditability:** semua perubahan metadata tercatat (created/updated + audit detail opsional).
- **Security:** Supabase RLS aktif; hanya user authenticated yang bisa akses.
- **Usability:** input cepat, minim klik, default tanggal “now”.

---

## 7. Data & perhitungan stok

### 7.1 Sumber kebenaran
- Ledger `stock_movements` adalah sumber histori.
- `product_stocks` digunakan sebagai cache stok saat ini untuk:
  - mempercepat tampilan stok
  - validasi OUT yang atomik

### 7.2 Perhitungan
- IN menambah stok.
- OUT mengurangi stok.
- ADJUST menambah/mengurangi sesuai tanda.

### 7.3 Validasi utama
- Stok tidak boleh negatif.

---

## 8. Rancangan data (high-level)

### 8.1 Tabel
- `products`
- `categories`
- `product_stocks`
- `stock_movements`
- `stock_movement_audits` (recommended)

### 8.2 Kolom penting
- `stock_movements.created_at` menjadi patokan window 2 hari.
- `stock_movements.movement_at` adalah tanggal kejadian (bisa backdate), digunakan untuk laporan/grafik.

### 8.3 Enforce window 2 hari
- Semua operasi edit dan koreksi harus mengecek:
  - `now() <= created_at + interval '2 days'`

---

## 9. Rancangan halaman (Information Architecture)
- `/login`
- `/dashboard`
- `/products`
- `/movements`
  - list + filter + export CSV
  - actions: add IN / add OUT / koreksi / opname

---

## 10. Acceptance Criteria (MVP)

1) **Stok tidak bisa minus**
- Ketika membuat OUT melebihi stok saat ini, sistem menolak dan menampilkan pesan stok tersedia.

2) **IN/OUT qty tidak bisa diubah**
- Pada halaman edit IN/OUT, field qty/type/product tidak dapat diedit.

3) **Semua edit dibatasi 2 hari**
- Setelah lewat 2 hari dari `created_at`, tombol edit disabled atau submit ditolak dengan pesan yang jelas.

4) **Koreksi dibatasi 2 hari sejak transaksi asal dicatat**
- Saat membuat koreksi terhadap transaksi asal yang sudah >2 hari, sistem menolak.

5) **Grafik hanya IN vs OUT**
- ADJUST tidak memengaruhi grafik.

6) **Export CSV sesuai filter**
- CSV yang diunduh sesuai range tanggal & filter lain yang dipilih.

---

## 11. Risiko & mitigasi
- **Race condition stok** jika validasi dilakukan hanya di client/server Next.js.
  - Mitigasi: gunakan RPC Postgres + lock baris `product_stocks` saat update.
- **Kategori bebas** bisa menyebabkan data tidak konsisten.
  - Mitigasi: gunakan master `categories` + inline create; hindari free-text kategori.
- **Backdate** dapat membuat histori rapih tapi tidak selalu merepresentasikan waktu input.
  - Mitigasi: audit `created_at` vs `movement_at` ditampilkan di riwayat.

---

## 12. Rencana rilis

### Sprint 1 (MVP core)
- Auth
- Produk
- Kategori inline create
- IN/OUT + validasi stok
- Riwayat + filter
- Dashboard chart harian + stok saat ini
- Export CSV

### Sprint 2 (operasional)
- Stock opname bulk
- Chart bulanan/tahunan
- Audit detail (before/after) jika belum
- UX speed improvements (quick add, keyboard-friendly)

---