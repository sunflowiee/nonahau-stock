import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";

import { DashboardFilters } from "@/app/(app)/dashboard/_components/dashboard-filters";
import { InOutChart } from "@/app/(app)/dashboard/_components/in-out-chart";
import { LinkButton } from "@/components/app/link-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Granularity, WIB_TZ, defaultRangeForGranularity } from "@/lib/date";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type SearchParams = {
  product?: string;
  granularity?: Granularity;
};

type ProductOption = {
  id: number;
  name: string;
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

type MovementRow = {
  movement_id: number;
  movement_at: string;
  product_id: number;
  product_name: string;
  type: "IN" | "OUT" | "ADJUST";
  qty_pcs: number;
  signed_qty_pcs: number;
  category_name: string;
  description: string | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatSignedNumber(value: number) {
  if (value > 0) return `+${formatNumber(value)}`;
  if (value < 0) return `-${formatNumber(Math.abs(value))}`;
  return "0";
}

function formatScopePeriod(from: Date, to: Date) {
  return `${formatInTimeZone(from, WIB_TZ, "dd MMM yyyy")} - ${formatInTimeZone(to, WIB_TZ, "dd MMM yyyy")}`;
}

function describeGranularity(granularity: Granularity) {
  if (granularity === "day") return "7 hari terakhir";
  if (granularity === "month") return "12 bulan terakhir";
  return "5 tahun terakhir";
}

function movementBadgeVariant(type: MovementRow["type"]) {
  if (type === "IN") return "secondary";
  if (type === "OUT") return "default";
  return "outline";
}

function movementQty(row: MovementRow) {
  if (row.type === "IN") return Number(row.qty_pcs ?? 0);
  if (row.type === "OUT") return Number(row.qty_pcs ?? 0) * -1;
  return Number(row.signed_qty_pcs ?? 0);
}

function buildMovementHref(type: "IN" | "OUT", productId: number | null) {
  const params = new URLSearchParams({ type });
  if (productId !== null) params.set("product", String(productId));
  return `/movements/new?${params.toString()}`;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  return (
    <Card className="shadow-none" size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardAction>
          <div className="rounded-md border border-border/60 bg-muted/40 p-2 text-muted-foreground">
            <Icon className="size-4" />
          </div>
        </CardAction>
        <CardTitle
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            tone === "positive" && "text-emerald-600 dark:text-emerald-400",
            tone === "warning" && "text-amber-600 dark:text-amber-400",
            tone === "danger" && "text-destructive"
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-xs text-muted-foreground">{description}</CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const granularity: Granularity = sp.granularity ?? "day";
  const requestedProductId = sp.product ? Number(sp.product) : null;
  const { from, to } = defaultRangeForGranularity(granularity);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const supabase = await createSupabaseServerClient();

  const { data: products } = await supabase
    .from("products")
    .select("id,name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const activeProducts = (products ?? []) as ProductOption[];
  const selectedProduct = activeProducts.find((product) => product.id === requestedProductId) ?? null;
  const scopedProductId = selectedProduct?.id ?? null;

  if (activeProducts.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan stok dan transaksi.
          </p>
        </header>

        <Card className="shadow-none">
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <div className="text-base font-medium tracking-tight">Belum ada produk aktif</div>
            <p className="max-w-md text-sm text-muted-foreground">
              Tambahkan produk untuk mulai melihat dashboard.
            </p>
            <LinkButton href="/products" variant="outline" className="h-9">
              Kelola Produk
            </LinkButton>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stocksQuery = supabase.rpc("get_current_stocks");
  const seriesQuery = supabase.rpc("get_in_out_series", {
    p_from: fromIso,
    p_to: toIso,
    p_product_id: scopedProductId,
    p_granularity: granularity,
  });
  let recentMovementsQuery = supabase
    .from("v_stock_movements_export")
    .select("movement_id,movement_at,product_id,product_name,type,qty_pcs,signed_qty_pcs,category_name,description")
    .order("movement_at", { ascending: false })
    .limit(8);
  let movementCountQuery = supabase
    .from("v_stock_movements_export")
    .select("movement_id", { count: "exact", head: true })
    .in("type", ["IN", "OUT"])
    .gte("movement_at", fromIso)
    .lte("movement_at", toIso);

  if (scopedProductId !== null) {
    recentMovementsQuery = recentMovementsQuery.eq("product_id", scopedProductId);
    movementCountQuery = movementCountQuery.eq("product_id", scopedProductId);
  }

  const [stocksResult, seriesResult, recentMovementsResult, movementCountResult] = await Promise.all([
    stocksQuery,
    seriesQuery,
    recentMovementsQuery,
    movementCountQuery,
  ]);

  const stockRows = ((stocksResult.data ?? []) as unknown as StockRow[]).sort(
    (a, b) => Number(b.qty_pcs ?? 0) - Number(a.qty_pcs ?? 0)
  );
  const scopedStockRows = scopedProductId !== null
    ? stockRows.filter((row) => row.product_id === scopedProductId)
    : stockRows;
  const seriesRows = (seriesResult.data ?? []) as unknown as SeriesRow[];
  const recentMovements = (recentMovementsResult.data ?? []) as unknown as MovementRow[];

  const totalCurrentStock = scopedStockRows.reduce((sum, row) => sum + Number(row.qty_pcs ?? 0), 0);
  const totalIn = seriesRows.reduce((sum, row) => sum + Number(row.in_qty ?? 0), 0);
  const totalOut = seriesRows.reduce((sum, row) => sum + Number(row.out_qty ?? 0), 0);
  const netFlow = totalIn - totalOut;
  const movementCount = movementCountResult.count ?? 0;
  const productsInScope = scopedStockRows.length;
  const nonZeroStockCount = scopedStockRows.filter((row) => Number(row.qty_pcs ?? 0) > 0).length;
  const zeroStockRows = scopedStockRows.filter((row) => Number(row.qty_pcs ?? 0) === 0);
  const zeroStockCount = zeroStockRows.length;
  const topStockRows = [...scopedStockRows].sort((a, b) => Number(b.qty_pcs ?? 0) - Number(a.qty_pcs ?? 0)).slice(0, 5);
  const latestMovement = recentMovements[0] ?? null;

  const periodLabel = formatScopePeriod(from, to);
  const granularityLabel = describeGranularity(granularity);
  const scopeTitle = selectedProduct ? selectedProduct.name : "Semua produk";
  const latestMovementLabel = latestMovement
    ? formatInTimeZone(new Date(latestMovement.movement_at), WIB_TZ, "dd MMM yyyy, HH:mm")
    : "Belum ada transaksi";

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan stok dan transaksi.
          </p>
        </div>
        <DashboardFilters products={activeProducts} />
      </header>

      <Card className="shadow-none">
        <CardContent className="grid gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{scopeTitle}</Badge>
              <span>{granularityLabel}</span>
              <span>•</span>
              <span>{periodLabel}</span>
            </div>

            <div className="space-y-1">
              <div className="text-lg font-semibold tracking-tight">
                {selectedProduct ? `Pantau ${selectedProduct.name}` : "Pantau semua produk"}
              </div>
              <p className="text-sm text-muted-foreground">
                Terakhir update: {latestMovementLabel}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LinkButton href={buildMovementHref("IN", scopedProductId)} className="h-9">
              Catat IN
            </LinkButton>
            <LinkButton href={buildMovementHref("OUT", scopedProductId)} variant="outline" className="h-9">
              Catat OUT
            </LinkButton>
            <LinkButton href="/movements" variant="outline" className="h-9">
              Buka Inventory
            </LinkButton>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          title="Stok saat ini"
          value={`${formatNumber(totalCurrentStock)} pcs`}
          description={selectedProduct ? "Scope terpilih." : `${productsInScope} produk.`}
          icon={Boxes}
        />
        <StatCard
          title="Total IN"
          value={`${formatNumber(totalIn)} pcs`}
          description={`Masuk pada ${granularityLabel.toLowerCase()}.`}
          icon={ArrowUpRight}
          tone="positive"
        />
        <StatCard
          title="Total OUT"
          value={`${formatNumber(totalOut)} pcs`}
          description={`Keluar pada ${granularityLabel.toLowerCase()}.`}
          icon={ArrowDownRight}
          tone="warning"
        />
        <StatCard
          title="Selisih bersih"
          value={`${formatSignedNumber(netFlow)} pcs`}
          description="IN dikurangi OUT." 
          icon={TrendingUp}
          tone={netFlow < 0 ? "danger" : netFlow > 0 ? "positive" : "default"}
        />
        <StatCard
          title="Transaksi IN/OUT"
          value={formatNumber(movementCount)}
          description="Transaksi pada periode ini."
          icon={ClipboardList}
        />
        <StatCard
          title={selectedProduct ? "Status stok" : "Produk stok kosong"}
          value={selectedProduct ? (zeroStockCount > 0 ? "Kosong" : "Tersedia") : formatNumber(zeroStockCount)}
          description={selectedProduct ? "Kondisi stok saat ini." : `${nonZeroStockCount} produk masih tersedia.`}
          icon={TriangleAlert}
          tone={zeroStockCount > 0 ? "danger" : "default"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Tren IN vs OUT</CardTitle>
            <CardDescription>
              {scopeTitle} • {periodLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <InOutChart granularity={granularity} data={seriesRows} />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Sorotan stok</CardTitle>
            <CardDescription>
              Stok tertinggi dan stok kosong.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topStockRows.length > 0 ? (
              <div className="space-y-3">
                {topStockRows.map((row, index) => (
                  <div key={row.product_id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">#{index + 1}</div>
                      <div className="truncate font-medium">{row.product_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="tabular-nums font-semibold tracking-tight">{formatNumber(Number(row.qty_pcs ?? 0))}</div>
                      <div className="text-xs text-muted-foreground">pcs</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Belum ada data stok.
              </div>
            )}

            <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Activity className="size-4 text-muted-foreground" />
                <span>Catatan</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {zeroStockCount > 0
                  ? `${zeroStockCount} produk saat ini berada di stok 0${zeroStockRows.length > 0 ? `: ${zeroStockRows.slice(0, 3).map((row) => row.product_name).join(", ")}${zeroStockCount > 3 ? ", ..." : ""}` : ""}.`
                  : "Semua produk masih tersedia."}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)]">
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Aktivitas terbaru</CardTitle>
            <CardDescription>
              Transaksi terbaru di scope ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentMovements.length === 0 ? (
              <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                Belum ada transaksi.
              </div>
            ) : (
              <div className="space-y-3">
                {recentMovements.map((row) => {
                  const qty = movementQty(row);
                  return (
                    <div key={row.movement_id} className="rounded-md border border-border/60 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={movementBadgeVariant(row.type)}>{row.type}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatInTimeZone(new Date(row.movement_at), WIB_TZ, "dd MMM yyyy, HH:mm")}
                            </span>
                          </div>
                          <div className="font-medium">{row.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {row.category_name}{row.description ? ` • ${row.description}` : ""}
                          </div>
                        </div>

                        <div
                          className={cn(
                            "shrink-0 text-right text-sm font-semibold tabular-nums tracking-tight",
                            qty > 0 && "text-emerald-600 dark:text-emerald-400",
                            qty < 0 && "text-amber-600 dark:text-amber-400"
                          )}
                        >
                          {formatSignedNumber(qty)} pcs
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Stok saat ini per produk</CardTitle>
            <CardDescription>
              Snapshot stok saat ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border border-border/60">
              <div className="max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Stok (pcs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedStockRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                          Tidak ada data stok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      scopedStockRows.map((row) => {
                        const qty = Number(row.qty_pcs ?? 0);
                        return (
                          <TableRow key={row.product_id}>
                            <TableCell className="font-medium">{row.product_name}</TableCell>
                            <TableCell>
                              {qty === 0 ? <Badge variant="outline">Kosong</Badge> : <Badge variant="secondary">Tersedia</Badge>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(qty)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
