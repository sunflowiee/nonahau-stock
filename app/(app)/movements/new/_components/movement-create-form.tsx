"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Product = { id: number; name: string };
type Category = { id: number; name: string };
type StockRow = { product_id: number; product_name?: string; qty_pcs: number };

type MovementType = "IN" | "OUT";

type Initial = {
  type: MovementType;
  productId: number | null;
};

type FormVariant = "page" | "drawer";

function toLocalInputValue(d: Date) {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(localValue: string) {
  return new Date(localValue).toISOString();
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Terjadi kesalahan";
}

export function MovementCreateForm({
  products,
  categories,
  stocks,
  initial,
  variant = "page",
  lockProduct = false,
  onSubmittedAction,
}: {
  products: Product[];
  categories: Category[];
  stocks: StockRow[];
  initial: Initial;
  variant?: FormVariant;
  lockProduct?: boolean;
  onSubmittedAction?: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [type, setType] = useState<MovementType>(initial.type);
  const [movementAt, setMovementAt] = useState(() => toLocalInputValue(new Date()));
  const [productId, setProductId] = useState<string>(initial.productId ? String(initial.productId) : "");
  const [categoryId, setCategoryId] = useState<string>(categories[0] ? String(categories[0].id) : "");
  const [categoryList, setCategoryList] = useState<Category[]>(categories);
  const [description, setDescription] = useState<string>("");
  const [qtyPcs, setQtyPcs] = useState<string>("");

  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const stockByProductId = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of stocks) m.set(s.product_id, Number(s.qty_pcs ?? 0));
    return m;
  }, [stocks]);

  const selectedStock = useMemo(() => {
    const id = Number(productId);
    if (!id) return 0;
    return stockByProductId.get(id) ?? 0;
  }, [productId, stockByProductId]);

  async function createCategory() {
    setIsCreatingCategory(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("create_category_if_not_exists", {
        p_name: newCategoryName,
      });
      if (rpcError) throw rpcError;

      const created = data as unknown as Category;
      setCategoryList((prev) => {
        const exists = prev.some((c) => c.id === created.id);
        return exists ? prev : [created, ...prev];
      });
      setCategoryId(String(created.id));
      setNewCategoryName("");
      setSuccess("Kategori ditambahkan.");
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Gagal menambahkan kategori");
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function submitMovement() {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const pid = Number(productId);
    const cid = Number(categoryId);
    const qty = Number(qtyPcs);

    if (!pid) {
      setError("Produk wajib dipilih.");
      setIsSubmitting(false);
      return;
    }
    if (!cid) {
      setError("Kategori wajib dipilih.");
      setIsSubmitting(false);
      return;
    }
    if (!qty || qty <= 0) {
      setError("Qty (pcs) wajib > 0.");
      setIsSubmitting(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("create_stock_movement", {
      p_movement_at: fromLocalInputValue(movementAt),
      p_product_id: pid,
      p_type: type,
      p_qty_pcs: qty,
      p_adjust_sign: null,
      p_adjust_kind: null,
      p_correction_for_movement_id: null,
      p_category_id: cid,
      p_description: description || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      setIsSubmitting(false);
      return;
    }

    setSuccess("Transaksi tersimpan.");
    router.replace("/movements");
    router.refresh();
    onSubmittedAction?.();
  }

  const submitLabel = type === "IN" ? "Simpan Stock In" : "Simpan Stock Out";

  const header = (
    <>
      {variant === "page" ? <CardTitle className="text-sm font-medium">Form</CardTitle> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={type === "IN" ? "default" : "outline"}
          className="h-9"
          onClick={() => setType("IN")}
        >
          IN
        </Button>
        <Button
          type="button"
          variant={type === "OUT" ? "default" : "outline"}
          className="h-9"
          onClick={() => setType("OUT")}
        >
          OUT
        </Button>
      </div>
    </>
  );

  const content = (
    <>
        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            {success}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="movementAt">Tanggal/Jam</Label>
            <Input
              id="movementAt"
              type="datetime-local"
              value={movementAt}
              onChange={(e) => setMovementAt(e.target.value)}
              className="h-9"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label>Kategori</Label>
            <div className="flex gap-2">
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categoryList.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Dialog>
                <DialogTrigger
                  type="button"
                  className={buttonVariants({ variant: "outline", className: "h-9 shrink-0" })}
                >
                  Tambah
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tambah Kategori</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="newCategory">Nama</Label>
                    <Input
                      id="newCategory"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Mis. Reject"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" onClick={createCategory} disabled={isCreatingCategory}>
                      {isCreatingCategory ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Produk</Label>
            <Select value={productId} onValueChange={(v) => setProductId(v ?? "")} disabled={isSubmitting || lockProduct}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Pilih produk" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {productId ? (
              <div className="text-xs text-muted-foreground">
                Stok saat ini: <span className="tabular-nums">{selectedStock}</span> pcs
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="qty">Qty (pcs)</Label>
            <Input
              id="qty"
              inputMode="numeric"
              value={qtyPcs}
              onChange={(e) => setQtyPcs(e.target.value)}
              placeholder="0"
              className="h-9"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">Deskripsi</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opsional"
            className="min-h-24"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            className="min-w-40"
            onClick={submitMovement}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Menyimpan..." : submitLabel}
          </Button>
        </div>
    </>
  );

  if (variant === "drawer") {
    return (
      <div className="space-y-5">
        <div className="space-y-3">{header}</div>
        <div className="space-y-5">{content}</div>
      </div>
    );
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="space-y-3">{header}</CardHeader>
      <CardContent className="space-y-5">{content}</CardContent>
    </Card>
  );
}
