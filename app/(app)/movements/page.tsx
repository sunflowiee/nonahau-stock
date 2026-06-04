import { InventoryTabs } from "@/app/(app)/movements/_components/inventory-tabs";
import { LinkButton } from "@/components/app/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { Granularity, currentPeriodRangeForGranularity } from "@/lib/date";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = {
  granularity?: Granularity;
};

function normalizeGranularity(value: SearchParams["granularity"]): Granularity {
  if (value === "month" || value === "year") return value;
  return "day";
}

function getPeriodLabel(granularity: Granularity) {
  if (granularity === "day") return "hari ini";
  if (granularity === "month") return "bulan ini";
  return "tahun ini";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const granularity = normalizeGranularity(sp.granularity);
  const { from, to } = currentPeriodRangeForGranularity(granularity);
  const supabase = await createSupabaseServerClient();

  const [{ data: products }, { data: categories }, { data: stocks }, { data: rows }] = await Promise.all([
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
    supabase.from("product_stocks").select("product_id,qty_pcs"),
    supabase
      .from("v_stock_movements_export")
      .select(
        "movement_id,movement_at,product_id,product_name,type,qty_pcs,signed_qty_pcs,category_id,category_name,description,created_at,updated_at"
      )
      .in("type", ["IN", "OUT"])
      .gte("movement_at", from.toISOString())
      .lte("movement_at", to.toISOString())
      .order("movement_at", { ascending: false }),
  ]);

  const exportParams = new URLSearchParams({ only: "inout" });
  const activeProducts = products ?? [];

  return (
    <div className="space-y-6">
      {activeProducts.length === 0 ? (
        <>
          <div className="sticky top-0 z-20 -mx-6 -mt-6 bg-background/95 px-6 pt-6 supports-backdrop-filter:backdrop-blur-sm">
            <header className="border-b border-border/40 pb-4">
              <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
            </header>
          </div>

          <Card className="shadow-none">
            <CardContent className="flex min-h-60 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <div className="text-base font-medium tracking-tight">produk tidak ada</div>
              <p className="max-w-md text-sm text-muted-foreground">
                Tambahkan produk terlebih dahulu agar data inventory dan tracking bisa ditampilkan di halaman ini.
              </p>
              <LinkButton href="/products" variant="outline" className="mt-2 h-9">
                Kelola Produk
              </LinkButton>
            </CardContent>
          </Card>
        </>
      ) : (
        <InventoryTabs
          exportHref={`/api/export/movements?${exportParams.toString()}`}
          granularity={granularity}
          periodLabel={getPeriodLabel(granularity)}
          products={activeProducts}
          categories={(categories ?? []) as Array<{ id: number; name: string }>}
          stocks={(stocks ?? []) as Array<{ product_id: number; qty_pcs: number; product_name?: string }>}
          rows={
            (rows ?? []) as Array<{
              movement_id: number;
              movement_at: string;
              created_at: string;
              product_id: number;
              product_name: string;
              type: "IN" | "OUT" | "ADJUST";
              qty_pcs: number;
              signed_qty_pcs: number;
              category_id: number;
              category_name: string;
              description: string | null;
            }>
          }
        />
      )}
    </div>
  );
}
