# Supabase RPC Contract — Dimsum Nonahau Stock System (MVP v1)

Dokumen ini menjelaskan cara aplikasi Next.js memanggil Supabase (RPC) untuk:
- membuat transaksi `IN/OUT/ADJUST`
- edit metadata transaksi (window 2 hari)
- inline create kategori
- ambil data grafik IN vs OUT (harian/bulanan/tahunan)
- export CSV

> Catatan penting:
> - Jangan melakukan `insert/update` langsung ke tabel `stock_movements` untuk operasi bisnis inti.
> - Selalu gunakan RPC agar validasi stok dan aturan “2 hari” berlaku konsisten.

---

## 1) Inline create kategori

### Function
`create_category_if_not_exists(p_name text) -> categories`

### Behaviour
- Trim input
- Jika kategori sudah ada: aktifkan kembali (`is_active=true`) dan return row
- Jika belum ada: insert dan return row

### Example payload
```/dev/null/rpc_payloads.json#L1-10
{
  "p_name": "Jual"
}
```

---

## 2) Create transaction (IN/OUT/ADJUST)

### Function
`create_stock_movement(
  p_movement_at timestamptz,
  p_product_id bigint,
  p_type movement_type,
  p_qty_pcs bigint,
  p_adjust_sign smallint,
  p_adjust_kind adjust_kind,
  p_correction_for_movement_id bigint,
  p_category_id bigint,
  p_description text
) -> stock_movements`

### Rules enforced
- `qty_pcs > 0`
- `OUT` tidak boleh melebihi `product_stocks.qty_pcs` saat ini
- Stok akhir tidak boleh < 0
- `ADJUST` wajib punya `adjust_sign` dan `adjust_kind`
- `ADJUST.CORRECTION` wajib punya `correction_for_movement_id` dan:
  - origin harus `IN/OUT`
  - origin harus produk yang sama
  - koreksi hanya boleh <= 2 hari sejak origin dicatat (`origin.created_at`)
- `category_id` wajib

### 2.1 Create IN
```/dev/null/rpc_payloads.json#L12-27
{
  "p_movement_at": "2026-05-20T10:00:00+07:00",
  "p_product_id": 1,
  "p_type": "IN",
  "p_qty_pcs": 5000,
  "p_adjust_sign": null,
  "p_adjust_kind": null,
  "p_correction_for_movement_id": null,
  "p_category_id": 10,
  "p_description": "Produksi hari ini"
}
```

### 2.2 Create OUT
```/dev/null/rpc_payloads.json#L29-44
{
  "p_movement_at": "2026-05-20T15:30:00+07:00",
  "p_product_id": 1,
  "p_type": "OUT",
  "p_qty_pcs": 300,
  "p_adjust_sign": null,
  "p_adjust_kind": null,
  "p_correction_for_movement_id": null,
  "p_category_id": 11,
  "p_description": "Jual ke reseller A"
}
```

### 2.3 Create ADJUST — Koreksi (+)
Misal sebelumnya OUT kurang tercatat 20 pcs, maka koreksi adalah `-20` atau `+20`?
- Kalau stok sistem **terlalu tinggi** (seharusnya berkurang), koreksi harus **negatif** (`adjust_sign=-1`, `qty_pcs=20`).
- Kalau stok sistem **terlalu rendah** (seharusnya bertambah), koreksi harus **positif** (`adjust_sign=1`).

Contoh koreksi negatif 20 pcs untuk transaksi asal id=123:
```/dev/null/rpc_payloads.json#L46-64
{
  "p_movement_at": "2026-05-21T09:00:00+07:00",
  "p_product_id": 1,
  "p_type": "ADJUST",
  "p_qty_pcs": 20,
  "p_adjust_sign": -1,
  "p_adjust_kind": "CORRECTION",
  "p_correction_for_movement_id": 123,
  "p_category_id": 12,
  "p_description": "Koreksi: OUT kemarin kurang tercatat 20 pcs"
}
```

### 2.4 Create ADJUST — Opname
Opname tidak butuh `correction_for_movement_id`.
Contoh opname positif 100 pcs:
```/dev/null/rpc_payloads.json#L66-83
{
  "p_movement_at": "2026-05-31T20:00:00+07:00",
  "p_product_id": 1,
  "p_type": "ADJUST",
  "p_qty_pcs": 100,
  "p_adjust_sign": 1,
  "p_adjust_kind": "OPNAME",
  "p_correction_for_movement_id": null,
  "p_category_id": 13,
  "p_description": "Opname akhir bulan"
}
```

---

## 3) Update metadata (edit window 2 hari)

### Function
`update_stock_movement_metadata(
  p_id bigint,
  p_movement_at timestamptz,
  p_category_id bigint,
  p_description text
) -> stock_movements`

### Rules
- Hanya boleh update sebelum 2 hari sejak transaksi dicatat: `now() <= created_at + 2 days`
- Untuk `IN/OUT`, trigger juga memastikan `qty/type/product` tidak berubah.

### Example payload
```/dev/null/rpc_payloads.json#L85-96
{
  "p_id": 123,
  "p_movement_at": "2026-05-20T16:00:00+07:00",
  "p_category_id": 11,
  "p_description": "Update catatan: pengiriman sore"
}
```

---

## 4) Data untuk dashboard (grafik IN vs OUT)

### RPC: current stock table
`get_current_stocks() -> table(product_id bigint, product_name text, qty_pcs bigint)`

- Mengembalikan stok saat ini untuk semua produk aktif, diurutkan berdasarkan nama.


Karena Supabase client tidak ideal untuk SQL `date_trunc` + timezone grouping, disarankan menambah RPC khusus untuk chart.

### RPC
`get_in_out_series(p_from timestamptz, p_to timestamptz, p_product_id bigint, p_granularity text) -> table(bucket_start timestamptz, in_qty bigint, out_qty bigint)`

- `p_granularity`: `'day' | 'month' | 'year'`
- bucket dihitung dalam WIB (Asia/Jakarta)
- hanya menghitung type `IN` dan `OUT`
- jika `p_product_id` null → agregasi semua produk

> Function ini sudah ditambahkan ke `schema.sql`.

---

## 5) Export CSV

### Data source
- View `v_stock_movements_export` (recommended) sudah join `product_name` + qty signed.
- View `v_stock_movements_signed` masih tersedia jika butuh raw.

### Filtering (server-side Next.js)
- filter by `movement_at` range
- filter by `product_id` (optional)
- filter by `type` (optional)
- filter by `category_id` (optional)

Kolom CSV minimum:
- `movement_at`
- `product_name`
- `type`
- `qty_pcs` atau `signed_qty_pcs`
- `category_name`
- `description`
- `created_at`, `updated_at`

---

## 6) Error messages (UX)
Aplikasi sebaiknya menangkap error dari RPC dan menampilkan pesan yang jelas:
- `Stok tidak cukup...`
- `Edit ditolak: sudah lewat batas 2 hari...`
- `Koreksi ditolak: sudah lewat batas 2 hari...`
- `Kategori wajib diisi`
