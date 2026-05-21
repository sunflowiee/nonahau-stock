import { CategoriesManager } from "@/app/(app)/categories/_components/categories-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CategoriesPage() {
  const supabase = await createSupabaseServerClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id,name,is_active,created_at")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Kategori</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kategori dipakai untuk memberi konteks transaksi (Produksi, Jual, Retur, Koreksi, dll).
        </p>
      </header>

      <CategoriesManager initialCategories={categories ?? []} />
    </div>
  );
}
