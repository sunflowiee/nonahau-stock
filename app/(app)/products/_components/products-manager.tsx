"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Product = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
};

export function ProductsManager({ initialProducts }: { initialProducts: Product[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase
      .from("products")
      .select("id,name,is_active,created_at")
      .order("name", { ascending: true });
    setProducts((data as Product[]) ?? []);
  }

  async function createProduct() {
    setIsCreating(true);
    setError(null);

    const { error: insertError } = await supabase.from("products").insert({ name: newName });
    if (insertError) {
      setError(insertError.message);
      setIsCreating(false);
      return;
    }

    setNewName("");
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
            <div className="space-y-2">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Mis. Hakau"
              />
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
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
                          Rename
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Rename Produk</DialogTitle>
                          </DialogHeader>
                          <RenameForm
                            initialName={p.name}
                            onSave={async (name) => updateProduct(p.id, { name })}
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

function RenameForm({
  initialName,
  onSave,
}: {
  initialName: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="rename">Nama</Label>
        <Input id="rename" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <DialogFooter>
        <Button
          onClick={async () => {
            setIsSubmitting(true);
            await onSave(name);
            setIsSubmitting(false);
          }}
          disabled={isSubmitting || !name.trim()}
        >
          {isSubmitting ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </div>
  );
}
