import { MovementCreateForm } from "@/app/(app)/movements/new/_components/movement-create-form";
import { LinkButton } from "@/components/app/link-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = {
  type?: "IN" | "OUT";
  product?: string;
};

export default async function NewMovementPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const type = sp.type === "OUT" ? "OUT" : "IN";
  const prefilledProductId = sp.product ? Number(sp.product) : null;

  const supabase = await createSupabaseServerClient();

  const [{ data: products }, { data: categories }, { data: stocks }] = await Promise.all([
    supabase
      .from("products")
      .select("id,name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("categories")
      .select("id,name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.rpc("get_current_stocks"),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tambah Transaksi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catat stok masuk dan stok keluar. Produk tetap, tapi qty, tipe, kategori, tanggal, dan deskripsi masih bisa diubah selama 2 hari.
          </p>
        </div>
        <LinkButton href="/movements" variant="outline" className="h-9">
          Kembali
        </LinkButton>
      </header>

      <MovementCreateForm
        products={products ?? []}
        categories={categories ?? []}
        stocks={stocks ?? []}
        initial={{
          type,
          productId: prefilledProductId,
        }}
      />
    </div>
  );
}
