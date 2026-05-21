import { MovementsFilters } from "@/app/(app)/movements/_components/movements-filters";
import { MovementsTable } from "@/app/(app)/movements/_components/movements-table";
import { LinkButton } from "@/components/app/link-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { defaultRangeForGranularity } from "@/lib/date";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = {
  from?: string;
  to?: string;
  product?: string;
  type?: string;
  category?: string;
};

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  const defaultRange = defaultRangeForGranularity("day");
  const from = sp.from ? new Date(sp.from) : defaultRange.from;
  const to = sp.to ? new Date(sp.to) : defaultRange.to;

  const productId = sp.product ? Number(sp.product) : null;
  const type = sp.type && sp.type !== "all" ? sp.type : null;
  const categoryId = sp.category ? Number(sp.category) : null;

  const [{ data: products }, { data: categories }] = await Promise.all([
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
  ]);

  let q = supabase
    .from("v_stock_movements_export")
    .select(
      "movement_id,movement_at,product_id,product_name,type,qty_pcs,signed_qty_pcs,category_id,category_name,description,created_at,updated_at"
    )
    .gte("movement_at", from.toISOString())
    .lte("movement_at", to.toISOString())
    .order("movement_at", { ascending: false });

  if (productId) q = q.eq("product_id", productId);
  if (type) q = q.eq("type", type);
  if (categoryId) q = q.eq("category_id", categoryId);

  const { data: rows } = await q;

  const exportParams = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  if (productId) exportParams.set("product", String(productId));
  if (type) exportParams.set("type", type);
  if (categoryId) exportParams.set("category", String(categoryId));
  exportParams.set("only", "inout");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Transaksi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catatan IN/OUT/Koreksi/Opname. Edit hanya boleh dalam 2 hari sejak dicatat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href="/movements/new?type=IN" variant="outline" className="h-9">
            Stock In
          </LinkButton>
          <LinkButton href="/movements/new?type=OUT" variant="outline" className="h-9">
            Stock Out
          </LinkButton>
          <LinkButton href="/movements/new?type=ADJUST&kind=CORRECTION" variant="outline" className="h-9">
            Koreksi
          </LinkButton>
          <LinkButton href="/movements/new?type=ADJUST&kind=OPNAME" variant="outline" className="h-9">
            Opname
          </LinkButton>
          <a
            href={`/api/export/movements?${exportParams.toString()}`}
            className={cn(buttonVariants({ className: "h-9" }))}
          >
            Export CSV
          </a>
        </div>
      </header>

      <Card className="shadow-none">
        <CardContent className="pt-6">
          <MovementsFilters
            products={products ?? []}
            categories={categories ?? []}
            initial={{
              from: from.toISOString(),
              to: to.toISOString(),
              product: productId ? String(productId) : "all",
              type: type ?? "all",
              category: categoryId ? String(categoryId) : "all",
            }}
          />
        </CardContent>
      </Card>

      <MovementsTable rows={rows ?? []} />
    </div>
  );
}
