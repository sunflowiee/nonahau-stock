"use client";

import { useMemo } from "react";

import { InventoryBatchInput } from "@/app/(app)/movements/_components/inventory-batch-input";
import { InventoryGranularityFilter } from "@/app/(app)/movements/_components/inventory-granularity-filter";
import { MovementExportDialog } from "@/app/(app)/movements/_components/movement-export-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Granularity } from "@/lib/date";

type Product = {
  id: number;
  name: string;
};

type Category = {
  id: number;
  name: string;
};

type MovementRow = {
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
};

type StockRow = {
  product_id: number;
  product_name?: string;
  qty_pcs: number;
};

export function InventoryTabs({
  products,
  categories,
  rows,
  stocks,
  exportHref,
  granularity,
  periodLabel,
}: {
  products: Product[];
  categories: Category[];
  rows: MovementRow[];
  stocks: StockRow[];
  exportHref: string;
  granularity: Granularity;
  periodLabel: string;
}) {
  const rowsByProduct = useMemo(() => {
    const map = new Map<number, MovementRow[]>();
    for (const product of products) {
      map.set(product.id, []);
    }

    for (const row of rows) {
      const current = map.get(row.product_id);
      if (current) current.push(row);
    }

    return map;
  }, [products, rows]);

  const stockByProduct = useMemo(() => {
    const map = new Map<number, number>();
    for (const stock of stocks) {
      map.set(stock.product_id, Number(stock.qty_pcs ?? 0));
    }
    return map;
  }, [stocks]);

  return (
    <Tabs defaultValue={String(products[0]?.id)} className="min-w-0 gap-0">
      <div className="sticky top-0 z-20 -mx-6 -mt-6 bg-background/95 px-6 pt-6 supports-backdrop-filter:backdrop-blur-sm">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Menampilkan tracking transaksi untuk {periodLabel}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <InventoryGranularityFilter />
            <MovementExportDialog exportHref={exportHref} />
          </div>
        </header>

        <div className="overflow-x-auto overflow-y-hidden border-b border-border/40">
          <TabsList
            variant="line"
            className="min-w-max gap-5 rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-auto"
          >
            {products.map((product) => (
              <TabsTrigger
                key={product.id}
                value={String(product.id)}
                className="h-auto flex-none rounded-none border-x-0 border-t-0 border-b-[3px] border-b-transparent bg-transparent px-0 py-3 text-sm font-medium leading-none text-muted-foreground shadow-none after:hidden hover:text-foreground data-active:border-b-foreground/30 data-active:bg-transparent data-active:text-foreground data-active:shadow-none dark:data-active:border-b-foreground/20"
              >
                {product.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      {products.map((product) => {
        const productRows = rowsByProduct.get(product.id) ?? [];
        const currentStock = stockByProduct.get(product.id) ?? 0;
        const totalIn = productRows
          .filter((row) => row.type === "IN")
          .reduce((sum, row) => sum + Number(row.qty_pcs ?? 0), 0);
        const totalOut = productRows
          .filter((row) => row.type === "OUT")
          .reduce((sum, row) => sum + Number(row.qty_pcs ?? 0), 0);

        return (
          <TabsContent key={product.id} value={String(product.id)} className="min-w-0 space-y-4 pt-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="gap-2 py-0 shadow-none">
                <CardContent className="px-4 py-4">
                  <div className="text-xs text-muted-foreground">Produk</div>
                  <div className="mt-1 text-base font-semibold tracking-tight">{product.name}</div>
                </CardContent>
              </Card>

              <Card className="gap-2 py-0 shadow-none">
                <CardContent className="px-4 py-4">
                  <div className="text-xs text-muted-foreground">Stok saat ini</div>
                  <div className="mt-1 text-base font-semibold tabular-nums tracking-tight">{currentStock} pcs</div>
                </CardContent>
              </Card>

              <Card className="gap-2 py-0 shadow-none">
                <CardContent className="px-4 py-4">
                  <div className="text-xs text-muted-foreground">
                    Tracking {granularity === "day" ? "hari ini" : granularity === "month" ? "bulan ini" : "tahun ini"}
                  </div>
                  <div className="mt-1 text-base font-semibold tabular-nums tracking-tight">{productRows.length} transaksi</div>
                  <div className="mt-1 text-xs text-muted-foreground">IN {totalIn} • OUT {totalOut}</div>
                </CardContent>
              </Card>
            </div>

            <InventoryBatchInput
              product={product}
              categories={categories}
              existingRows={productRows}
              periodLabel={periodLabel}
            />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
