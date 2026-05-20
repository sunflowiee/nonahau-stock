-- Dimsum Nonahau — Stock System
-- Supabase Postgres schema (MVP v1)
--
-- Notes:
-- - Semua stok disimpan dalam PCS.
-- - OUT tidak boleh melebihi stok saat ini (dicek atomik via RPC + row lock).
-- - IN/OUT tidak boleh diubah qty/type/product; perbaikan via ADJUST.
-- - Semua edit metadata dibatasi max 2 hari sejak created_at.
-- - Koreksi (ADJUST: CORRECTION) dibatasi max 2 hari sejak transaksi asal (origin) dicatat (origin.created_at).
-- - ADJUST tidak ditampilkan di grafik, namun tetap tersimpan untuk audit dan perhitungan stok.

begin;

-- 0) Extensions (optional but common)
-- create extension if not exists pgcrypto;

-- 1) Types
create type public.movement_type as enum ('IN', 'OUT', 'ADJUST');
create type public.adjust_kind as enum ('CORRECTION', 'OPNAME');

-- 2) Utility: updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 3) Utility: trim name trigger (avoids trailing/leading spaces)
create or replace function public.tg_trim_name()
returns trigger
language plpgsql
as $$
begin
  if new.name is not null then
    new.name := btrim(new.name);
  end if;
  return new;
end;
$$;

-- 4) Master tables
create table if not exists public.products (
  id bigserial primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_products_trim_name on public.products;
create trigger trg_products_trim_name
before insert or update on public.products
for each row execute function public.tg_trim_name();

drop trigger if exists trg_products_set_updated_at on public.products;
create trigger trg_products_set_updated_at
before update on public.products
for each row execute function public.tg_set_updated_at();

create table if not exists public.categories (
  id bigserial primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_categories_trim_name on public.categories;
create trigger trg_categories_trim_name
before insert or update on public.categories
for each row execute function public.tg_trim_name();

drop trigger if exists trg_categories_set_updated_at on public.categories;
create trigger trg_categories_set_updated_at
before update on public.categories
for each row execute function public.tg_set_updated_at();

-- 4) Current stock cache per product (PCS)
create table if not exists public.product_stocks (
  product_id bigint primary key references public.products(id) on delete cascade,
  qty_pcs bigint not null default 0 check (qty_pcs >= 0),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_product_stocks_set_updated_at on public.product_stocks;
create trigger trg_product_stocks_set_updated_at
before update on public.product_stocks
for each row execute function public.tg_set_updated_at();

-- 5) Ledger: stock movements
-- qty_pcs selalu > 0. Untuk ADJUST, tanda disimpan di adjust_sign (-1 atau 1).
-- category_name disimpan snapshot agar histori tetap kebaca jika kategori berubah/nonaktif.
create table if not exists public.stock_movements (
  id bigserial primary key,

  movement_at timestamptz not null default now(),

  product_id bigint not null references public.products(id),
  type public.movement_type not null,

  qty_pcs bigint not null check (qty_pcs > 0),
  adjust_sign smallint null check (adjust_sign in (-1, 1)),
  adjust_kind public.adjust_kind null,

  -- Untuk koreksi: link ke transaksi asal yang dikoreksi
  correction_for_movement_id bigint null references public.stock_movements(id),

  category_id bigint not null references public.categories(id),
  category_name text null,

  description text null,

  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_by uuid null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_movement_at
  on public.stock_movements (movement_at desc);
create index if not exists idx_stock_movements_product_at
  on public.stock_movements (product_id, movement_at desc);
create index if not exists idx_stock_movements_type_at
  on public.stock_movements (type, movement_at desc);
create index if not exists idx_stock_movements_created_at
  on public.stock_movements (created_at desc);

drop trigger if exists trg_stock_movements_set_updated_at on public.stock_movements;
create trigger trg_stock_movements_set_updated_at
before update on public.stock_movements
for each row execute function public.tg_set_updated_at();

-- 6) Audit trail (before/after JSON)
create table if not exists public.stock_movement_audits (
  id bigserial primary key,
  movement_id bigint not null references public.stock_movements(id) on delete cascade,
  changed_by uuid null,
  changed_at timestamptz not null default now(),
  before_json jsonb not null,
  after_json jsonb not null
);

create index if not exists idx_stock_movement_audits_movement
  on public.stock_movement_audits (movement_id, changed_at desc);

-- 7) Guards & helpers

-- 7.1) Enforce adjust_* consistency
create or replace function public.tg_stock_movements_adjust_guard()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'ADJUST' then
    if new.adjust_sign is null then
      raise exception 'adjust_sign wajib untuk ADJUST';
    end if;
    if new.adjust_kind is null then
      raise exception 'adjust_kind wajib untuk ADJUST';
    end if;

    if new.adjust_kind = 'CORRECTION' then
      if new.correction_for_movement_id is null then
        raise exception 'correction_for_movement_id wajib untuk ADJUST CORRECTION';
      end if;
    else
      -- OPNAME
      if new.correction_for_movement_id is not null then
        raise exception 'correction_for_movement_id harus null untuk ADJUST OPNAME';
      end if;
    end if;
  else
    -- IN/OUT
    if new.adjust_sign is not null or new.adjust_kind is not null or new.correction_for_movement_id is not null then
      raise exception 'adjust_sign/adjust_kind/correction_for_movement_id hanya boleh diisi untuk ADJUST';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stock_movements_adjust_guard on public.stock_movements;
create trigger trg_stock_movements_adjust_guard
before insert or update on public.stock_movements
for each row execute function public.tg_stock_movements_adjust_guard();

-- 7.2) Snapshot category name at insert/update when category_id is present
create or replace function public.tg_stock_movements_category_snapshot()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  if new.category_id is not null then
    select c.name into v_name from public.categories c where c.id = new.category_id;
    if v_name is null then
      raise exception 'category_id tidak valid';
    end if;
    new.category_name := v_name;
  else
    new.category_name := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stock_movements_category_snapshot on public.stock_movements;
create trigger trg_stock_movements_category_snapshot
before insert or update on public.stock_movements
for each row execute function public.tg_stock_movements_category_snapshot();

-- 7.3) Protect immutable fields for IN/OUT: product_id, type, qty_pcs
-- Koreksi angka dilakukan melalui ADJUST.
create or replace function public.tg_stock_movements_immutable_in_out()
returns trigger
language plpgsql
as $$
begin
  if old.type in ('IN', 'OUT') then
    if new.type <> old.type then
      raise exception 'type IN/OUT tidak boleh diubah';
    end if;
    if new.product_id <> old.product_id then
      raise exception 'product_id IN/OUT tidak boleh diubah';
    end if;
    if new.qty_pcs <> old.qty_pcs then
      raise exception 'qty_pcs IN/OUT tidak boleh diubah; gunakan ADJUST';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stock_movements_immutable_in_out on public.stock_movements;
create trigger trg_stock_movements_immutable_in_out
before update on public.stock_movements
for each row execute function public.tg_stock_movements_immutable_in_out();

-- 8) RPC (recommended) — atomic create/update operations

-- 8.1) Create or get category (inline create). Returns category row.
create or replace function public.create_category_if_not_exists(p_name text)
returns public.categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.categories;
  v_clean text;
begin
  v_clean := btrim(p_name);
  if v_clean is null or v_clean = '' then
    raise exception 'Nama kategori wajib diisi';
  end if;

  insert into public.categories(name)
  values (v_clean)
  on conflict (name)
  do update set is_active = true
  returning * into v_row;

  return v_row;
end;
$$;

-- 8.2) Helper: signed delta for a movement input
create or replace function public.signed_delta(
  p_type public.movement_type,
  p_qty_pcs bigint,
  p_adjust_sign smallint
) returns bigint
language plpgsql
as $$
begin
  if p_qty_pcs <= 0 then
    raise exception 'qty_pcs harus > 0';
  end if;

  if p_type = 'IN' then
    return p_qty_pcs;
  elsif p_type = 'OUT' then
    return -p_qty_pcs;
  elsif p_type = 'ADJUST' then
    if p_adjust_sign not in (-1, 1) then
      raise exception 'adjust_sign harus -1 atau 1 untuk ADJUST';
    end if;
    return p_qty_pcs * p_adjust_sign;
  else
    raise exception 'movement_type tidak dikenal';
  end if;
end;
$$;

-- 8.3) Create stock movement (IN/OUT/ADJUST) atomically and update product_stocks.
--
-- Validation summary:
-- - OUT qty <= current stock
-- - Final stock must be >= 0
create or replace function public.create_stock_movement(
  p_movement_at timestamptz,
  p_product_id bigint,
  p_type public.movement_type,
  p_qty_pcs bigint,
  p_adjust_sign smallint,
  p_adjust_kind public.adjust_kind,
  p_correction_for_movement_id bigint,
  p_category_id bigint,
  p_description text
) returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock bigint;
  v_row public.stock_movements;
  v_delta bigint;
  v_new_stock bigint;
  v_origin_created_at timestamptz;
  v_origin_type public.movement_type;
  v_origin_product_id bigint;
begin
  -- ensure stock row exists
  insert into public.product_stocks(product_id, qty_pcs)
  values (p_product_id, 0)
  on conflict (product_id) do nothing;

  -- lock stock row
  select qty_pcs into v_stock
  from public.product_stocks
  where product_id = p_product_id
  for update;

  v_delta := public.signed_delta(p_type, p_qty_pcs, p_adjust_sign);

  -- ADJUST extra validation
  if p_category_id is null then
    raise exception 'Kategori wajib diisi';
  end if;

  if p_type = 'ADJUST' then
    if p_adjust_kind is null then
      raise exception 'adjust_kind wajib untuk ADJUST';
    end if;

    if p_adjust_kind = 'CORRECTION' then
      if p_correction_for_movement_id is null then
        raise exception 'correction_for_movement_id wajib untuk CORRECTION';
      end if;

      -- Load origin movement (must exist, must be IN/OUT, must be same product)
      select created_at, type, product_id
      into v_origin_created_at, v_origin_type, v_origin_product_id
      from public.stock_movements
      where id = p_correction_for_movement_id;

      if v_origin_created_at is null then
        raise exception 'Transaksi asal koreksi tidak ditemukan';
      end if;

      if v_origin_type not in ('IN', 'OUT') then
        raise exception 'Koreksi hanya boleh mengacu ke transaksi IN/OUT';
      end if;

      if v_origin_product_id <> p_product_id then
        raise exception 'Produk koreksi harus sama dengan produk transaksi asal';
      end if;

      -- Correction window: within 2 days of origin.created_at
      if now() > (v_origin_created_at + interval '2 days') then
        raise exception 'Koreksi ditolak: sudah lewat batas 2 hari sejak transaksi asal dicatat';
      end if;
    end if;
  end if;

  -- OUT validation (based on current stock)
  if p_type = 'OUT' and p_qty_pcs > v_stock then
    raise exception 'Stok tidak cukup. Stok saat ini: %, qty out: %', v_stock, p_qty_pcs;
  end if;

  v_new_stock := v_stock + v_delta;
  if v_new_stock < 0 then
    raise exception 'Stok tidak boleh minus. Stok saat ini: %, delta: %', v_stock, v_delta;
  end if;

  insert into public.stock_movements(
    movement_at,
    product_id,
    type,
    qty_pcs,
    adjust_sign,
    adjust_kind,
    correction_for_movement_id,
    category_id,
    description,
    created_by,
    updated_by
  ) values (
    coalesce(p_movement_at, now()),
    p_product_id,
    p_type,
    p_qty_pcs,
    case when p_type = 'ADJUST' then p_adjust_sign else null end,
    case when p_type = 'ADJUST' then p_adjust_kind else null end,
    case when p_type = 'ADJUST' and p_adjust_kind = 'CORRECTION' then p_correction_for_movement_id else null end,
    p_category_id,
    p_description,
    auth.uid(),
    auth.uid()
  ) returning * into v_row;

  update public.product_stocks
  set qty_pcs = v_new_stock
  where product_id = p_product_id;

  return v_row;
end;
$$;

-- 8.4) Update movement metadata only (movement_at, category_id, description)
-- Applies to all types, but blocked after 2 days from created_at.
create or replace function public.update_stock_movement_metadata(
  p_id bigint,
  p_movement_at timestamptz,
  p_category_id bigint,
  p_description text
) returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.stock_movements;
  v_new public.stock_movements;
  v_before jsonb;
  v_after jsonb;
begin
  select * into v_old
  from public.stock_movements
  where id = p_id;

  if not found then
    raise exception 'Movement tidak ditemukan';
  end if;

  -- Edit window: within 2 days from created_at (rule B)
  if now() > (v_old.created_at + interval '2 days') then
    raise exception 'Edit ditolak: sudah lewat batas 2 hari sejak transaksi dicatat';
  end if;

  v_before := to_jsonb(v_old);

  if p_category_id is null then
    raise exception 'Kategori wajib diisi';
  end if;

  update public.stock_movements
  set
    movement_at = coalesce(p_movement_at, v_old.movement_at),
    category_id = p_category_id,
    description = p_description,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_id
  returning * into v_new;

  v_after := to_jsonb(v_new);

  insert into public.stock_movement_audits(movement_id, changed_by, before_json, after_json)
  values (p_id, auth.uid(), v_before, v_after);

  return v_new;
end;
$$;

-- 8.5) Dashboard series: IN vs OUT grouped by day/month/year (WIB buckets)
create or replace function public.get_in_out_series(
  p_from timestamptz,
  p_to timestamptz,
  p_product_id bigint,
  p_granularity text
)
returns table (
  bucket_start timestamptz,
  in_qty bigint,
  out_qty bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step interval;
  v_start_local timestamp;
  v_end_local timestamp;
  v_bucket_expr text;
begin
  if p_granularity not in ('day', 'month', 'year') then
    raise exception 'granularity harus salah satu dari: day, month, year';
  end if;

  if p_granularity = 'day' then
    v_step := interval '1 day';
  elsif p_granularity = 'month' then
    v_step := interval '1 month';
  else
    v_step := interval '1 year';
  end if;

  -- compute bucket range in WIB (local timestamp)
  v_start_local := date_trunc(p_granularity, timezone('Asia/Jakarta', coalesce(p_from, now() - interval '30 days')));
  v_end_local := date_trunc(p_granularity, timezone('Asia/Jakarta', coalesce(p_to, now())));

  return query
  with buckets as (
    select gs as bucket_local
    from generate_series(v_start_local, v_end_local, v_step) as gs
  ), agg as (
    select
      date_trunc(p_granularity, timezone('Asia/Jakarta', m.movement_at)) as bucket_local,
      sum(m.qty_pcs) filter (where m.type = 'IN') as in_qty,
      sum(m.qty_pcs) filter (where m.type = 'OUT') as out_qty
    from public.stock_movements m
    where m.type in ('IN', 'OUT')
      and (p_from is null or m.movement_at >= p_from)
      and (p_to is null or m.movement_at <= p_to)
      and (p_product_id is null or m.product_id = p_product_id)
    group by 1
  )
  select
    timezone('Asia/Jakarta', b.bucket_local) as bucket_start,
    coalesce(a.in_qty, 0) as in_qty,
    coalesce(a.out_qty, 0) as out_qty
  from buckets b
  left join agg a
    on a.bucket_local = b.bucket_local
  order by b.bucket_local;
end;
$$;

-- 8.6) Dashboard table: current stocks (active products)
create or replace function public.get_current_stocks()
returns table (
  product_id bigint,
  product_name text,
  qty_pcs bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as product_id,
    p.name as product_name,
    coalesce(s.qty_pcs, 0) as qty_pcs
  from public.products p
  left join public.product_stocks s on s.product_id = p.id
  where p.is_active = true
  order by p.name asc;
$$;

-- 9) Views for convenience
-- Signed qty view (useful for list/export)
create or replace view public.v_stock_movements_signed as
select
  m.*,
  case
    when m.type = 'IN' then m.qty_pcs
    when m.type = 'OUT' then -m.qty_pcs
    when m.type = 'ADJUST' then (m.qty_pcs * m.adjust_sign)
  end as signed_qty_pcs
from public.stock_movements m;

-- Export-friendly view with joins
create or replace view public.v_stock_movements_export as
select
  m.id as movement_id,
  m.movement_at,
  m.created_at,
  m.updated_at,
  m.created_by,
  m.updated_by,
  m.product_id,
  p.name as product_name,
  m.type,
  m.qty_pcs,
  case
    when m.type = 'IN' then m.qty_pcs
    when m.type = 'OUT' then -m.qty_pcs
    when m.type = 'ADJUST' then (m.qty_pcs * m.adjust_sign)
  end as signed_qty_pcs,
  m.adjust_kind,
  m.adjust_sign,
  m.correction_for_movement_id,
  m.category_id,
  m.category_name,
  m.description
from public.stock_movements m
join public.products p on p.id = m.product_id;

-- 10) Grants for RPC
-- Restrict execute privileges to authenticated (and optionally service_role).
revoke all on function public.create_category_if_not_exists(text) from public;
revoke all on function public.create_stock_movement(timestamptz, bigint, public.movement_type, bigint, smallint, public.adjust_kind, bigint, bigint, text) from public;
revoke all on function public.update_stock_movement_metadata(bigint, timestamptz, bigint, text) from public;
revoke all on function public.get_in_out_series(timestamptz, timestamptz, bigint, text) from public;
revoke all on function public.get_current_stocks() from public;

grant execute on function public.create_category_if_not_exists(text) to authenticated;
grant execute on function public.create_stock_movement(timestamptz, bigint, public.movement_type, bigint, smallint, public.adjust_kind, bigint, bigint, text) to authenticated;
grant execute on function public.update_stock_movement_metadata(bigint, timestamptz, bigint, text) to authenticated;
grant execute on function public.get_in_out_series(timestamptz, timestamptz, bigint, text) to authenticated;
grant execute on function public.get_current_stocks() to authenticated;

-- 10.1) Privilege hardening (recommended)
-- Prevent direct writes from client; force business operations through RPC.
revoke insert, update, delete on table public.stock_movements from anon, authenticated;
revoke insert, update, delete on table public.product_stocks from anon, authenticated;
revoke insert, update, delete on table public.stock_movement_audits from anon, authenticated;

grant select on table public.stock_movements to authenticated;
grant select on table public.product_stocks to authenticated;
grant select on table public.stock_movement_audits to authenticated;

grant select on table public.v_stock_movements_signed to authenticated;
grant select on table public.v_stock_movements_export to authenticated;

-- 11) RLS policies
-- Strategy:
-- - Allow authenticated SELECT on all.
-- - Allow authenticated INSERT only (optional); for stricter control, you can revoke insert/update and use only RPC.
-- - Disallow direct UPDATE/DELETE; metadata updates should go via RPC `update_stock_movement_metadata`.

alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.product_stocks enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_movement_audits enable row level security;

-- PRODUCTS
drop policy if exists products_select on public.products;
create policy products_select
on public.products for select
to authenticated
using (true);

drop policy if exists products_write on public.products;
create policy products_write
on public.products for insert
to authenticated
with check (true);

drop policy if exists products_update on public.products;
create policy products_update
on public.products for update
to authenticated
using (true)
with check (true);

-- CATEGORIES
drop policy if exists categories_select on public.categories;
create policy categories_select
on public.categories for select
to authenticated
using (true);

drop policy if exists categories_insert on public.categories;
create policy categories_insert
on public.categories for insert
to authenticated
with check (true);

drop policy if exists categories_update on public.categories;
create policy categories_update
on public.categories for update
to authenticated
using (true)
with check (true);

-- PRODUCT_STOCKS
-- Select allowed for dashboard. Insert/Update allowed so RPC bisa jalan.
-- (Untuk mengunci akses langsung dari client, gunakan REVOKE table privileges di luar RLS.)
drop policy if exists product_stocks_select on public.product_stocks;
create policy product_stocks_select
on public.product_stocks for select
to authenticated
using (true);

drop policy if exists product_stocks_insert_auth on public.product_stocks;
create policy product_stocks_insert_auth
on public.product_stocks for insert
to authenticated
with check (true);

drop policy if exists product_stocks_update_auth on public.product_stocks;
create policy product_stocks_update_auth
on public.product_stocks for update
to authenticated
using (true)
with check (true);

-- STOCK_MOVEMENTS
-- Allow select.
-- INSERT/UPDATE via RPC: enable policies that allow rows where created_by/updated_by = auth.uid().
-- (RPC sudah mengisi created_by/updated_by = auth.uid()).
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select
on public.stock_movements for select
to authenticated
using (true);

drop policy if exists stock_movements_insert_self on public.stock_movements;
create policy stock_movements_insert_self
on public.stock_movements for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists stock_movements_update_self on public.stock_movements;
create policy stock_movements_update_self
on public.stock_movements for update
to authenticated
using (true)
with check (updated_by = auth.uid());

-- AUDITS
drop policy if exists movement_audits_select on public.stock_movement_audits;
create policy movement_audits_select
on public.stock_movement_audits for select
to authenticated
using (true);

drop policy if exists movement_audits_insert_self on public.stock_movement_audits;
create policy movement_audits_insert_self
on public.stock_movement_audits for insert
to authenticated
with check (changed_by = auth.uid());

commit;

-- Post-setup manual steps (recommended):
-- 1) Ensure RPC functions are callable by authenticated users:
--    - In Supabase, set function permissions / grants as needed.
-- 2) Revoke direct table privileges if you want stricter control (optional):
--    - revoke insert, update, delete on public.stock_movements from authenticated;
--    - then rely purely on RPC.
-- 3) Seed initial categories: Produksi, Jual, Retur, Koreksi, Opname, Lainnya.
-- 4) Create products and initialize product_stocks rows (or let RPC create stock rows lazily).
