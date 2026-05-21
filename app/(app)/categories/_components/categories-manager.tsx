"use client";

import { useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Category = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
};

export function CategoriesManager({ initialCategories }: { initialCategories: Category[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase
      .from("categories")
      .select("id,name,is_active,created_at")
      .order("name", { ascending: true });
    setCategories((data as Category[]) ?? []);
  }

  async function createCategory() {
    setIsCreating(true);
    setError(null);

    // We use RPC for consistent behavior (trim + reactivate existing)
    const { error: rpcError } = await supabase.rpc("create_category_if_not_exists", {
      p_name: newName,
    });

    if (rpcError) {
      setError(rpcError.message);
      setIsCreating(false);
      return;
    }

    setNewName("");
    await refresh();
    setIsCreating(false);
  }

  async function updateCategory(id: number, patch: Partial<Category>) {
    setError(null);
    const { error: updateError } = await supabase.from("categories").update(patch).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refresh();
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">Daftar Kategori</CardTitle>

        <Dialog>
          <DialogTrigger type="button" className={buttonVariants({ className: "h-9" })}>
            Tambah Kategori
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah Kategori</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Mis. Reject"
              />
            </div>
            {error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={createCategory} disabled={isCreating || !newName.trim()}>
                {isCreating ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    {c.is_active ? <Badge variant="secondary">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
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
                            <DialogTitle>Rename Kategori</DialogTitle>
                          </DialogHeader>
                          <RenameForm
                            initialName={c.name}
                            onSave={async (name) => updateCategory(c.id, { name })}
                          />
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCategory(c.id, { is_active: !c.is_active })}
                      >
                        {c.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
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
