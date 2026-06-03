import { InventoryTabs } from "@/app/(app)/movements/_components/inventory-tabs";
import { LinkButton } from "@/components/app/link-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function InventoryPage() {
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
    supabase.rpc("get_current_stocks"),
    supabase
      .from("v_stock_movements_export")
      .select(
        "movement_id,movement_at,product_id,product_name,type,qty_pcs,signed_qty_pcs,category_id,category_name,description,created_at,updated_at"
      )
      .in("type", ["IN", "OUT"])
      .order("movement_at", { ascending: false }),
  ]);

  const exportParams = new URLSearchParams({ only: "inout" });
  const activeProducts = products ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pantau tracking stok per produk dalam tampilan tab yang rapi, ringkas, dan mudah dibaca.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/export/movements?${exportParams.toString()}`}
            className={cn(buttonVariants({ className: "h-9" }))}
          >
            Export CSV
          </a>
        </div>
      </header>

      {activeProducts.length === 0 ? (
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
      ) : (
        <InventoryTabs
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
