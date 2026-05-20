-- Dimsum Nonahau — seed data (optional)
-- Jalankan setelah schema.sql

begin;

insert into public.categories(name)
values
  ('Produksi'),
  ('Stok Awal'),
  ('Jual'),
  ('Retur'),
  ('Koreksi'),
  ('Opname'),
  ('Lainnya')
on conflict (name) do update set is_active = true;

commit;
