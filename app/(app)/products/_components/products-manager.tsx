"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Product = {
  id: number;
  name: string;
  min_stock_qty_pcs: number;
  is_active: boolean;
  created_at: string;
};

function parseMinStock(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Stok minimum harus berupa angka 0 atau lebih.");
  }
  return parsed;
}

export function ProductsManager({ initialProducts }: { initialProducts: Product[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [newName, setNewName] = useState("");
  const [newMinStock, setNewMinStock] = useState("0");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase
      .from("products")
      .select("id,name,min_stock_qty_pcs,is_active,created_at")
      .order("name", { ascending: true });
    setProducts((data as Product[]) ?? []);
  }

  async function createProduct() {
    setIsCreating(true);
    setError(null);

    let minStockValue = 0;

    try {
      minStockValue = parseMinStock(newMinStock);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stok minimum tidak valid.");
      setIsCreating(false);
      return;
    }

    const { error: insertError } = await supabase.from("products").insert({
      name: newName,
      min_stock_qty_pcs: minStockValue,
    });

    if (insertError) {
      setError(insertError.message);
      setIsCreating(false);
      return;
    }

    setNewName("");
    setNewMinStock("0");
    await refresh();
    setIsCreating(false);
  }

  async function updateProduct(id: number, patch: Partial<Product>) {
    setError(null);
    const { error: updateError } = await supabase.from("products").update(patch).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refresh();
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">Daftar Produk</CardTitle>

        <Dialog>
          <DialogTrigger type="button" className={buttonVariants({ className: "h-9" })}>
            Tambah Produk
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah Produk</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Mis. Hakau"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Stok minimum (pcs)</Label>
                <Input
                  id="minStock"
                  type="number"
                  min="0"
                  step="1"
                  value={newMinStock}
                  onChange={(e) => setNewMinStock(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={createProduct} disabled={isCreating || !newName.trim()}>
                {isCreating ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="rounded-md border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Stok minimum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.min_stock_qty_pcs}</TableCell>
                  <TableCell>
                    {p.is_active ? <Badge variant="secondary">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger
                          type="button"
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          Edit
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Edit Produk</DialogTitle>
                          </DialogHeader>
                          <EditProductForm
                            initialName={p.name}
                            initialMinStock={p.min_stock_qty_pcs}
                            onSave={async (payload) => updateProduct(p.id, payload)}
                          />
                        </DialogContent>
                      </Dialog>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={buttonVariants({ variant: "outline", size: "icon-sm" })}
                          aria-label="Aksi lainnya"
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant={p.is_active ? "destructive" : "default"}
                            onClick={() => updateProduct(p.id, { is_active: !p.is_active })}
                          >
                            {p.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function EditProductForm({
  initialName,
  initialMinStock,
  onSave,
}: {
  initialName: string;
  initialMinStock: number;
  onSave: (payload: { name: string; min_stock_qty_pcs: number }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [minStock, setMinStock] = useState(String(initialMinStock));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="editName">Nama</Label>
        <Input id="editName" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="editMinStock">Stok minimum (pcs)</Label>
        <Input
          id="editMinStock"
          type="number"
          min="0"
          step="1"
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
        />
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <DialogFooter>
        <Button
          onClick={async () => {
            setIsSubmitting(true);
            setError(null);

            try {
              await onSave({
                name,
                min_stock_qty_pcs: parseMinStock(minStock),
              });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Gagal menyimpan produk.");
            } finally {
              setIsSubmitting(false);
            }
          }}
          disabled={isSubmitting || !name.trim()}
        >
          {isSubmitting ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </div>
  );
}
