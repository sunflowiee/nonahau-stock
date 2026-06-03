import { DashboardFilters } from "@/app/(app)/dashboard/_components/dashboard-filters";
import { InOutChart } from "@/app/(app)/dashboard/_components/in-out-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Granularity } from "@/lib/date";
import { defaultRangeForGranularity } from "@/lib/date";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = {
  product?: string;
  granularity?: Granularity;
};

type StockRow = {
  product_id: number;
  product_name: string;
  qty_pcs: number;
};

type SeriesRow = {
  bucket_start: string;
  in_qty: number;
  out_qty: number;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const granularity: Granularity = sp.granularity ?? "day";
  const productId = sp.product ? Number(sp.product) : null;

  const { from, to } = defaultRangeForGranularity(granularity);

  const supabase = await createSupabaseServerClient();

  const [{ data: products }, { data: stocks }, { data: series }] = await Promise.all([
    supabase
      .from("products")
      .select("id,name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.rpc("get_current_stocks"),
    supabase.rpc("get_in_out_series", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_product_id: productId,
      p_granularity: granularity,
    }),
  ]);

  const stockRows = (stocks ?? []) as unknown as StockRow[];
  const seriesRows = (series ?? []) as unknown as SeriesRow[];

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan pergerakan stok (IN vs OUT). Default: 7 hari terakhir.
          </p>
        </div>
        <DashboardFilters products={products ?? []} />
      </header>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">IN vs OUT</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <InOutChart granularity={granularity} data={seriesRows} />
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Stok Saat Ini</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Stok (pcs)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockRows.map((row) => (
                  <TableRow key={row.product_id}>
                    <TableCell className="font-medium">{row.product_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.qty_pcs}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
