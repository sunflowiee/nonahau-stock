import { MovementCreateForm } from "@/app/(app)/movements/new/_components/movement-create-form";
import { LinkButton } from "@/components/app/link-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = {
  type?: "IN" | "OUT" | "ADJUST";
  kind?: "CORRECTION" | "OPNAME";
  origin?: string;
  product?: string;
};

export default async function NewMovementPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const type = sp.type ?? "IN";
  const kind = sp.kind ?? "CORRECTION";

  const originId = sp.origin ? Number(sp.origin) : null;
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
            IN/OUT tidak bisa dikoreksi dengan edit qty. Gunakan Koreksi (ADJUST) bila salah.
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
          kind,
          originId,
          productId: prefilledProductId,
        }}
      />
    </div>
  );
}
