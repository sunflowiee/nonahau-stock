import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { addDays, addMonths, addYears, startOfDay, startOfMonth, startOfYear } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

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
  min_stock_qty_pcs: number;
};

type StockRow = {
  product_id: number;
  product_name: string;
  qty_pcs: number;
  min_stock_qty_pcs: number;
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

type InOutSourceRow = {
  movement_at: string;
  type: "IN" | "OUT";
  qty_pcs: number;
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

function getBucketStart(date: Date, granularity: Granularity) {
  const zoned = toZonedTime(date, WIB_TZ);

  if (granularity === "day") {
    return fromZonedTime(startOfDay(zoned), WIB_TZ);
  }

  if (granularity === "month") {
    return fromZonedTime(startOfMonth(zoned), WIB_TZ);
  }

  return fromZonedTime(startOfYear(zoned), WIB_TZ);
}

function addBucket(date: Date, granularity: Granularity) {
  if (granularity === "day") return addDays(date, 1);
  if (granularity === "month") return addMonths(date, 1);
  return addYears(date, 1);
}

function buildInOutSeries(rows: InOutSourceRow[], from: Date, to: Date, granularity: Granularity): SeriesRow[] {
  const start = getBucketStart(from, granularity);
  const end = getBucketStart(to, granularity);
  const buckets: SeriesRow[] = [];
  const index = new Map<string, SeriesRow>();

  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addBucket(cursor, granularity)) {
    const key = cursor.toISOString();
    const entry: SeriesRow = {
      bucket_start: key,
      in_qty: 0,
      out_qty: 0,
    };
    buckets.push(entry);
    index.set(key, entry);
  }

  for (const row of rows) {
    const key = getBucketStart(new Date(row.movement_at), granularity).toISOString();
    const target = index.get(key);
    if (!target) continue;

    if (row.type === "IN") {
      target.in_qty += Number(row.qty_pcs ?? 0);
    } else {
      target.out_qty += Number(row.qty_pcs ?? 0);
    }
  }

  return buckets;
}

function getStockTone(qty: number, minStockQtyPcs: number) {
  if (qty <= 0) return "danger" as const;
  if (minStockQtyPcs > 0 && qty <= minStockQtyPcs) return "warning" as const;
  return "default" as const;
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
    .select("id,name,min_stock_qty_pcs")
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

  const activeProductIds = activeProducts.map((product) => product.id);

  const productStocksQuery = supabase
    .from("product_stocks")
    .select("product_id,qty_pcs")
    .in("product_id", activeProductIds);

  let recentMovementsQuery = supabase
    .from("v_stock_movements_export")
    .select("movement_id,movement_at,product_id,product_name,type,qty_pcs,signed_qty_pcs,category_name,description")
    .order("movement_at", { ascending: false })
    .limit(8);
  let inOutMovementsQuery = supabase
    .from("v_stock_movements_export")
    .select("movement_at,product_id,type,qty_pcs")
    .in("type", ["IN", "OUT"])
    .gte("movement_at", fromIso)
    .lte("movement_at", toIso)
    .order("movement_at", { ascending: true });

  if (scopedProductId !== null) {
    recentMovementsQuery = recentMovementsQuery.eq("product_id", scopedProductId);
    inOutMovementsQuery = inOutMovementsQuery.eq("product_id", scopedProductId);
  }

  const [productStocksResult, recentMovementsResult, inOutMovementsResult] = await Promise.all([
    productStocksQuery,
    recentMovementsQuery,
    inOutMovementsQuery,
  ]);

  const warnings: string[] = [];

  if (productStocksResult.error) {
    warnings.push("Stok saat ini belum berhasil dimuat.");
  }

  if (recentMovementsResult.error) {
    warnings.push("Aktivitas terbaru belum berhasil dimuat.");
  }

  if (inOutMovementsResult.error) {
    warnings.push("Data grafik belum berhasil dimuat.");
  }

  const minStockByProduct = new Map(
    activeProducts.map((product) => [product.id, Number(product.min_stock_qty_pcs ?? 0)])
  );
  const stockQtyByProduct = new Map(
    ((productStocksResult.data ?? []) as Array<{ product_id: number; qty_pcs: number }>).map((row) => [
      row.product_id,
      Number(row.qty_pcs ?? 0),
    ])
  );

  const stockRows: StockRow[] = activeProducts
    .map((product) => ({
      product_id: product.id,
      product_name: product.name,
      qty_pcs: stockQtyByProduct.get(product.id) ?? 0,
      min_stock_qty_pcs: minStockByProduct.get(product.id) ?? 0,
    }))
    .sort((a, b) => Number(b.qty_pcs ?? 0) - Number(a.qty_pcs ?? 0));
  const scopedStockRows = scopedProductId !== null
    ? stockRows.filter((row) => row.product_id === scopedProductId)
    : stockRows;
  const inOutRows = (inOutMovementsResult.data ?? []) as unknown as InOutSourceRow[];
  const seriesRows = buildInOutSeries(inOutRows, from, to, granularity);
  const recentMovements = (recentMovementsResult.data ?? []) as unknown as MovementRow[];

  const totalCurrentStock = scopedStockRows.reduce((sum, row) => sum + Number(row.qty_pcs ?? 0), 0);
  const totalIn = seriesRows.reduce((sum, row) => sum + Number(row.in_qty ?? 0), 0);
  const totalOut = seriesRows.reduce((sum, row) => sum + Number(row.out_qty ?? 0), 0);
  const netFlow = totalIn - totalOut;
  const movementCount = inOutRows.length;
  const productsInScope = scopedStockRows.length;
  const nonZeroStockCount = scopedStockRows.filter((row) => Number(row.qty_pcs ?? 0) > 0).length;
  const zeroStockCount = scopedStockRows.filter((row) => Number(row.qty_pcs ?? 0) === 0).length;
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

      {warnings.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {warnings[0]}
        </div>
      ) : null}



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

      <section>
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
                      <TableHead className="text-right">Stok (pcs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedStockRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="py-10 text-center text-sm text-muted-foreground">
                          Tidak ada data stok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      scopedStockRows.map((row) => {
                        const qty = Number(row.qty_pcs ?? 0);
                        const minStock = Number(row.min_stock_qty_pcs ?? 0);
                        const tone = getStockTone(qty, minStock);
                        return (
                          <TableRow key={row.product_id}>
                            <TableCell className="font-medium">{row.product_name}</TableCell>
                            <TableCell className="text-right">
                              <div
                                className={cn(
                                  "tabular-nums font-semibold tracking-tight",
                                  tone === "warning" && "text-amber-600 dark:text-amber-400",
                                  tone === "danger" && "text-destructive"
                                )}
                              >
                                {formatNumber(qty)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {minStock > 0 ? `min ${formatNumber(minStock)} pcs` : "—"}
                              </div>
                            </TableCell>
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
