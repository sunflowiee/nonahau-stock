# Next.js usage guide (Supabase RPC) — Dimsum Nonahau

Dokumen ini berisi contoh pemanggilan RPC dari Next.js (App Router) untuk kebutuhan MVP.

> Catatan: contoh ini fokus ke konsep. Nanti saat project Next.js dibuat, kita akan menyesuaikan struktur folder, auth helper, dan error handling.

---

## 1) Panggil RPC: create IN/OUT

```/dev/null/nextjs_rpc_examples.ts#L1-60
// server action / route handler
// asumsi: kamu punya supabase server client yang sudah auth via cookies

const { data, error } = await supabase.rpc('create_stock_movement', {
  p_movement_at: new Date().toISOString(),
  p_product_id: 1,
  p_type: 'IN',
  p_qty_pcs: 5000,
  p_adjust_sign: null,
  p_adjust_kind: null,
  p_correction_for_movement_id: null,
  p_category_id: 1,
  p_description: 'Produksi hari ini',
});

if (error) {
  // contoh error message dari DB: "Stok tidak cukup..." / "Kategori wajib diisi" / dll
  throw new Error(error.message);
}

return data;
```

OUT:
```/dev/null/nextjs_rpc_examples.ts#L62-110
const { data, error } = await supabase.rpc('create_stock_movement', {
  p_movement_at: new Date().toISOString(),
  p_product_id: 1,
  p_type: 'OUT',
  p_qty_pcs: 300,
  p_adjust_sign: null,
  p_adjust_kind: null,
  p_correction_for_movement_id: null,
  p_category_id: 2,
  p_description: 'Jual ke reseller A',
});

if (error) throw new Error(error.message);
return data;
```

---

## 2) Inline create kategori

```/dev/null/nextjs_rpc_examples.ts#L112-150
const { data: category, error } = await supabase.rpc('create_category_if_not_exists', {
  p_name: 'Reject',
});

if (error) throw new Error(error.message);
// category.id dipakai untuk p_category_id saat create_stock_movement
return category;
```

---

## 3) Koreksi (ADJUST: CORRECTION)

```/dev/null/nextjs_rpc_examples.ts#L152-215
// Koreksi negatif 20 pcs untuk transaksi asal id=123
const { data, error } = await supabase.rpc('create_stock_movement', {
  p_movement_at: new Date().toISOString(),
  p_product_id: 1,
  p_type: 'ADJUST',
  p_qty_pcs: 20,
  p_adjust_sign: -1,
  p_adjust_kind: 'CORRECTION',
  p_correction_for_movement_id: 123,
  p_category_id: 3, // contoh kategori "Koreksi"
  p_description: 'Koreksi: OUT kemarin kurang tercatat 20 pcs',
});

if (error) {
  // kemungkinan error:
  // - "Koreksi ditolak: sudah lewat batas 2 hari..."
  // - "Produk koreksi harus sama..."
  throw new Error(error.message);
}

return data;
```

---

## 4) Opname (ADJUST: OPNAME)

### 4.1 Single-product opname
Konsep: UI hitung selisih = fisik - stok_sistem, lalu kirim ADJUST.

```/dev/null/nextjs_rpc_examples.ts#L217-285
// contoh: stok sistem 900, fisik 1000 => delta +100
const delta = 100;

const { data, error } = await supabase.rpc('create_stock_movement', {
  p_movement_at: new Date().toISOString(),
  p_product_id: 1,
  p_type: 'ADJUST',
  p_qty_pcs: Math.abs(delta),
  p_adjust_sign: delta >= 0 ? 1 : -1,
  p_adjust_kind: 'OPNAME',
  p_correction_for_movement_id: null,
  p_category_id: 4, // contoh kategori "Opname"
  p_description: 'Opname mingguan',
});

if (error) throw new Error(error.message);
return data;
```

### 4.2 Bulk opname
Ulangi call per produk (paling gampang) atau batch (lebih advanced).

---

## 5) Edit transaksi (window 2 hari)

### 5.1 IN/OUT
```/dev/null/nextjs_rpc_examples.ts#L287-340
const { data, error } = await supabase.rpc('update_stock_movement', {
  p_id: 123,
  p_movement_at: new Date().toISOString(),
  p_type: 'OUT',
  p_qty_pcs: 300,
  p_category_id: 2,
  p_description: 'Revisi kategori dan deskripsi (masih dalam 2 hari)',
});

if (error) {
  // contoh: "Edit ditolak: sudah lewat batas 2 hari..."
  throw new Error(error.message);
}

return data;
```

### 5.2 ADJUST / metadata-only
```/dev/null/nextjs_rpc_examples.ts#L342-380
const { data, error } = await supabase.rpc('update_stock_movement_metadata', {
  p_id: 123,
  p_movement_at: new Date().toISOString(),
  p_category_id: 2,
  p_description: 'Revisi deskripsi (masih dalam 2 hari)',
});

if (error) {
  // contoh: "Edit ditolak: sudah lewat batas 2 hari..."
  throw new Error(error.message);
}

return data;
```

---

## 6) Hapus transaksi (window 2 hari)

```/dev/null/nextjs_rpc_examples.ts#L342-360
const { data, error } = await supabase.rpc('delete_stock_movement', {
  p_id: 123,
});

if (error) {
  // contoh:
  // - "Hapus ditolak: sudah lewat batas 2 hari..."
  // - "Hapus ditolak: stok tidak cukup untuk membatalkan transaksi ini..."
  // - "Hapus ditolak: transaksi ini masih dipakai sebagai acuan koreksi"
  throw new Error(error.message);
}

return data;
```

---

## 7) Dashboard data

### 7.1 Current stocks table
```/dev/null/nextjs_rpc_examples.ts#L342-370
const { data, error } = await supabase.rpc('get_current_stocks');
if (error) throw new Error(error.message);
return data; // [{ product_id, product_name, qty_pcs }, ...]
```

### 7.2 Chart series (IN vs OUT)
```/dev/null/nextjs_rpc_examples.ts#L372-430
const { data, error } = await supabase.rpc('get_in_out_series', {
  p_from: '2026-05-01T00:00:00+07:00',
  p_to: '2026-05-31T23:59:59+07:00',
  p_product_id: null,       // null = semua produk
  p_granularity: 'day',     // 'day' | 'month' | 'year'
});

if (error) throw new Error(error.message);
return data; // [{ bucket_start, in_qty, out_qty }, ...]
```

> Penting: untuk range tanggal “bulan ini” berbasis WIB, sebaiknya pakai library timezone (mis. `date-fns-tz` atau `luxon`) supaya tidak off-by-one.

---

## 8) Export CSV

Saran: export di server (Route Handler) dengan query ke view `v_stock_movements_export`, lalu ubah jadi CSV.

```/dev/null/nextjs_csv_export.ts#L1-80
const { data, error } = await supabase
  .from('v_stock_movements_export')
  .select('movement_at,product_name,type,qty_pcs,signed_qty_pcs,category_name,description,created_at,updated_at')
  .gte('movement_at', '2026-05-01T00:00:00+07:00')
  .lte('movement_at', '2026-05-31T23:59:59+07:00')
  .order('movement_at', { ascending: true });

if (error) throw new Error(error.message);

// lalu convert data -> CSV dan return response text/csv
```
