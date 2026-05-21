"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Product = { id: number; name: string };
type Category = { id: number; name: string };
type StockRow = { product_id: number; product_name: string; qty_pcs: number };

type MovementType = "IN" | "OUT" | "ADJUST";
type AdjustKind = "CORRECTION" | "OPNAME";

type Initial = {
  type: MovementType;
  kind: AdjustKind;
  originId: number | null;
  productId: number | null;
};

function toLocalInputValue(d: Date) {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(localValue: string) {
  return new Date(localValue).toISOString();
}

function modeFromQuery(qType: MovementType, qKind: AdjustKind) {
  if (qType === "IN") return "IN";
  if (qType === "OUT") return "OUT";
  if (qKind === "OPNAME") return "OPNAME";
  return "CORRECTION";
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
}: {
  products: Product[];
  categories: Category[];
  stocks: StockRow[];
  initial: Initial;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<MovementType>(initial.type);
  const [kind, setKind] = useState<AdjustKind>(initial.kind);
  const [originId, setOriginId] = useState<string>(initial.originId ? String(initial.originId) : "");

  const [movementAt, setMovementAt] = useState(() => toLocalInputValue(new Date()));
  const [productId, setProductId] = useState<string>(initial.productId ? String(initial.productId) : "");

  const [categoryId, setCategoryId] = useState<string>(categories[0] ? String(categories[0].id) : "");
  const [categoryList, setCategoryList] = useState<Category[]>(categories);

  const [description, setDescription] = useState<string>("");

  const [qtyPcs, setQtyPcs] = useState<string>("");
  const [adjustSign, setAdjustSign] = useState<1 | -1>(-1);

  const [opnameMode, setOpnameMode] = useState<"single" | "bulk">("single");
  const [physicalQty, setPhysicalQty] = useState<string>("");
  const [bulkPhysical, setBulkPhysical] = useState<Record<string, string>>({});

  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mode = modeFromQuery(type, kind);

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

  const computedDelta = useMemo(() => {
    if (!physicalQty) return null;
    const physical = Number(physicalQty);
    if (Number.isNaN(physical)) return null;
    return physical - selectedStock;
  }, [physicalQty, selectedStock]);

  function pushMode(next: { type: MovementType; kind?: AdjustKind }) {
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("type", next.type);
      if (next.type === "ADJUST") {
        nextParams.set("kind", next.kind ?? "CORRECTION");
      } else {
        nextParams.delete("kind");
        nextParams.delete("origin");
      }

      router.replace(`${pathname}?${nextParams.toString()}`);
      router.refresh();
    });
  }

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
        const next = exists ? prev : [created, ...prev];
        return next;
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

  async function submitSingleMovement() {
    setError(null);
    setSuccess(null);

    const pid = Number(productId);
    const cid = Number(categoryId);

    if (!pid) {
      setError("Produk wajib dipilih.");
      return;
    }
    if (!cid) {
      setError("Kategori wajib dipilih.");
      return;
    }

    const movementAtIso = fromLocalInputValue(movementAt);

    if (type === "IN" || type === "OUT") {
      const qty = Number(qtyPcs);
      if (!qty || qty <= 0) {
        setError("Qty (pcs) wajib > 0.");
        return;
      }

      const { error: rpcError } = await supabase.rpc("create_stock_movement", {
        p_movement_at: movementAtIso,
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
        return;
      }

      setSuccess("Transaksi tersimpan.");
      router.replace("/movements");
      router.refresh();
      return;
    }

    // ADJUST
    if (kind === "CORRECTION") {
      const qty = Number(qtyPcs);
      const origin = Number(originId);
      if (!origin) {
        setError("Origin ID (transaksi asal) wajib diisi.");
        return;
      }
      if (!qty || qty <= 0) {
        setError("Qty koreksi (pcs) wajib > 0.");
        return;
      }

      const { error: rpcError } = await supabase.rpc("create_stock_movement", {
        p_movement_at: movementAtIso,
        p_product_id: pid,
        p_type: "ADJUST",
        p_qty_pcs: qty,
        p_adjust_sign: adjustSign,
        p_adjust_kind: "CORRECTION",
        p_correction_for_movement_id: origin,
        p_category_id: cid,
        p_description: description || null,
      });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      setSuccess("Koreksi tersimpan.");
      router.replace("/movements");
      router.refresh();
      return;
    }

    // OPNAME (single)
    const physical = Number(physicalQty);
    if (Number.isNaN(physical) || physical < 0) {
      setError("Qty fisik harus angka >= 0.");
      return;
    }

    const delta = physical - selectedStock;
    if (delta === 0) {
      setSuccess("Tidak ada selisih (stok sudah sesuai).");
      return;
    }

    const { error: rpcError } = await supabase.rpc("create_stock_movement", {
      p_movement_at: movementAtIso,
      p_product_id: pid,
      p_type: "ADJUST",
      p_qty_pcs: Math.abs(delta),
      p_adjust_sign: delta >= 0 ? 1 : -1,
      p_adjust_kind: "OPNAME",
      p_correction_for_movement_id: null,
      p_category_id: cid,
      p_description: description || "Opname",
    });

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSuccess("Opname tersimpan.");
    router.replace("/movements");
    router.refresh();
  }

  async function submitBulkOpname() {
    setError(null);
    setSuccess(null);

    const cid = Number(categoryId);
    if (!cid) {
      setError("Kategori wajib dipilih.");
      return;
    }

    const movementAtIso = fromLocalInputValue(movementAt);

    type BulkInvalid = { productId: number; error: string };
    type BulkTask = { productId: number; qty: number; sign: 1 | -1 };

    const mixed: Array<BulkInvalid | BulkTask> = [];

    for (const p of products) {
      const v = bulkPhysical[String(p.id)];
      if (v === undefined || v === "") continue;

      const physical = Number(v);
      if (Number.isNaN(physical) || physical < 0) {
        mixed.push({ productId: p.id, error: `Qty fisik tidak valid untuk ${p.name}` });
        continue;
      }

      const current = stockByProductId.get(p.id) ?? 0;
      const delta = physical - current;
      if (delta === 0) continue;

      mixed.push({
        productId: p.id,
        qty: Math.abs(delta),
        sign: delta >= 0 ? 1 : -1,
      });
    }

    const invalid = mixed.find((t): t is BulkInvalid => "error" in t);
    if (invalid) {
      setError(invalid.error);
      return;
    }

    const tasks = mixed.filter((t): t is BulkTask => !("error" in t));

    if (tasks.length === 0) {
      setSuccess("Tidak ada selisih opname.");
      return;
    }

    for (const t of tasks) {
      const { error: rpcError } = await supabase.rpc("create_stock_movement", {
        p_movement_at: movementAtIso,
        p_product_id: t.productId,
        p_type: "ADJUST",
        p_qty_pcs: t.qty,
        p_adjust_sign: t.sign,
        p_adjust_kind: "OPNAME",
        p_correction_for_movement_id: null,
        p_category_id: cid,
        p_description: description || "Opname (bulk)",
      });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }
    }

    setSuccess("Opname bulk tersimpan.");
    router.replace("/movements");
    router.refresh();
  }

  const submitLabel = useMemo(() => {
    if (type === "IN") return "Simpan Stock In";
    if (type === "OUT") return "Simpan Stock Out";
    if (kind === "OPNAME") return opnameMode === "bulk" ? "Simpan Opname Bulk" : "Simpan Opname";
    return "Simpan Koreksi";
  }, [type, kind, opnameMode]);

  const productLocked = useMemo(() => {
    return Boolean(initial.originId) || Boolean(searchParams.get("origin"));
  }, [initial.originId, searchParams]);

  return (
    <Card className="shadow-none">
      <CardHeader className="space-y-3">
        <CardTitle className="text-sm font-medium">Form</CardTitle>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={mode === "IN" ? "default" : "outline"}
            className="h-9"
            onClick={() => {
              setType("IN");
              pushMode({ type: "IN" });
            }}
          >
            IN
          </Button>
          <Button
            type="button"
            variant={mode === "OUT" ? "default" : "outline"}
            className="h-9"
            onClick={() => {
              setType("OUT");
              pushMode({ type: "OUT" });
            }}
          >
            OUT
          </Button>
          <Button
            type="button"
            variant={mode === "CORRECTION" ? "default" : "outline"}
            className="h-9"
            onClick={() => {
              setType("ADJUST");
              setKind("CORRECTION");
              pushMode({ type: "ADJUST", kind: "CORRECTION" });
            }}
          >
            Koreksi
          </Button>
          <Button
            type="button"
            variant={mode === "OPNAME" ? "default" : "outline"}
            className="h-9"
            onClick={() => {
              setType("ADJUST");
              setKind("OPNAME");
              pushMode({ type: "ADJUST", kind: "OPNAME" });
            }}
          >
            Opname
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
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
            <Select
              value={productId}
              onValueChange={(v) => setProductId(v ?? "")}
              disabled={productLocked || isPending}
            >
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

          {type === "ADJUST" && kind === "CORRECTION" ? (
            <div className="space-y-2">
              <Label htmlFor="originId">Origin ID (Transaksi asal)</Label>
              <Input
                id="originId"
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
                placeholder="Mis. 123"
                className="h-9"
              />
              <div className="text-xs text-muted-foreground">
                Koreksi hanya boleh maksimal 2 hari sejak transaksi asal dicatat.
              </div>
            </div>
          ) : null}

          {type === "IN" || type === "OUT" || (type === "ADJUST" && kind === "CORRECTION") ? (
            <div className="space-y-2">
              <Label htmlFor="qty">Qty (pcs)</Label>
              <Input
                id="qty"
                inputMode="numeric"
                value={qtyPcs}
                onChange={(e) => setQtyPcs(e.target.value)}
                placeholder="0"
                className="h-9"
              />

              {type === "ADJUST" && kind === "CORRECTION" ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={adjustSign === 1 ? "default" : "outline"}
                    className="h-8"
                    onClick={() => setAdjustSign(1)}
                  >
                    + Tambah stok
                  </Button>
                  <Button
                    type="button"
                    variant={adjustSign === -1 ? "default" : "outline"}
                    className="h-8"
                    onClick={() => setAdjustSign(-1)}
                  >
                    - Kurangi stok
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {type === "ADJUST" && kind === "OPNAME" ? (
          <div className="space-y-4">
            <Tabs
              value={opnameMode}
              onValueChange={(v) => setOpnameMode(v === "bulk" ? "bulk" : "single")}
            >
              <TabsList className="h-9">
                <TabsTrigger value="single">Single</TabsTrigger>
                <TabsTrigger value="bulk">Bulk</TabsTrigger>
              </TabsList>
            </Tabs>

            {opnameMode === "single" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="physicalQty">Qty fisik (pcs)</Label>
                  <Input
                    id="physicalQty"
                    inputMode="numeric"
                    value={physicalQty}
                    onChange={(e) => setPhysicalQty(e.target.value)}
                    placeholder="0"
                    className="h-9"
                  />
                  <div className="text-xs text-muted-foreground">
                    Selisih: {computedDelta === null ? "—" : <span className="tabular-nums">{computedDelta}</span>} pcs
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60">
                <div className="grid grid-cols-3 gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  <div>Produk</div>
                  <div className="text-right">Stok sistem</div>
                  <div className="text-right">Qty fisik</div>
                </div>
                <div className="divide-y divide-border/60">
                  {products.map((p) => {
                    const current = stockByProductId.get(p.id) ?? 0;
                    const v = bulkPhysical[String(p.id)] ?? "";
                    return (
                      <div key={p.id} className="grid grid-cols-3 gap-2 px-3 py-2">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="text-right text-sm tabular-nums text-muted-foreground">{current}</div>
                        <div className="text-right">
                          <Input
                            inputMode="numeric"
                            value={v}
                            onChange={(e) =>
                              setBulkPhysical((prev) => ({
                                ...prev,
                                [String(p.id)]: e.target.value,
                              }))
                            }
                            placeholder="0"
                            className="h-8 text-right"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="desc">Deskripsi</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opsional (wajib untuk koreksi disarankan)"
            className="min-h-24"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            className="min-w-[160px]"
            onClick={() => {
              if (type === "ADJUST" && kind === "OPNAME" && opnameMode === "bulk") {
                submitBulkOpname();
              } else {
                submitSingleMovement();
              }
            }}
            disabled={isPending}
          >
            {submitLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
