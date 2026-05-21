import { ProductsManager } from "@/app/(app)/products/_components/products-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProductsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: products } = await supabase
    .from("products")
    .select("id,name,is_active,created_at")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Produk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Master jenis dimsum. Nonaktifkan jika sudah tidak dipakai, histori tetap tersimpan.
        </p>
      </header>

      <ProductsManager initialProducts={products ?? []} />
    </div>
  );
}
