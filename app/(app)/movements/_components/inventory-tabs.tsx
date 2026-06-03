"use client";

import { useMemo } from "react";

import { InventoryBatchInput } from "@/app/(app)/movements/_components/inventory-batch-input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
}: {
  products: Product[];
  categories: Category[];
  rows: MovementRow[];
  stocks: StockRow[];
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
    <Tabs defaultValue={String(products[0]?.id)} className="min-w-0 gap-4">
      <div className="overflow-x-auto pb-1">
        <TabsList className="h-auto min-w-max gap-1 rounded-xl bg-muted/60 p-1">
          {products.map((product) => (
            <TabsTrigger
              key={product.id}
              value={String(product.id)}
              className="h-10 min-w-35 rounded-lg px-4"
            >
              {product.name}
            </TabsTrigger>
          ))}
        </TabsList>
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
          <TabsContent key={product.id} value={String(product.id)} className="min-w-0 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
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
                  <div className="text-xs text-muted-foreground">Tracking tercatat</div>
                  <div className="mt-1 text-base font-semibold tabular-nums tracking-tight">{productRows.length} transaksi</div>
                  <div className="mt-1 text-xs text-muted-foreground">IN {totalIn} • OUT {totalOut}</div>
                </CardContent>
              </Card>
            </div>

            <InventoryBatchInput
              product={product}
              categories={categories}
              existingRows={productRows}
            />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
