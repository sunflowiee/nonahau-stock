"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";

type Movement = {
  movement_id: number;
  movement_at: string;
  created_at: string;
  product_name: string;
  type: "IN" | "OUT" | "ADJUST";
  qty_pcs: number;
  signed_qty_pcs: number;
  category_id: number;
  category_name: string;
  description: string | null;
};

type Category = {
  id: number;
  name: string;
};

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(localValue: string) {
  return new Date(localValue).toISOString();
}

export function MovementEditForm({
  movement,
  categories,
  variant = "page",
  onSubmittedAction,
}: {
  movement: Movement;
  categories: Category[];
  variant?: "page" | "drawer";
  onSubmittedAction?: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const categoryOptions = [
    ...categories,
    ...(!categories.some((category) => category.id === movement.category_id)
      ? [{ id: movement.category_id, name: movement.category_name }]
      : []),
  ];

  const [movementAt, setMovementAt] = useState(() => toLocalInputValue(movement.movement_at));
  const [movementType, setMovementType] = useState<"IN" | "OUT">(
    movement.type === "OUT" ? "OUT" : "IN"
  );
  const [qtyPcs, setQtyPcs] = useState(String(movement.qty_pcs));
  const [categoryId, setCategoryId] = useState(String(movement.category_id));
  const [description, setDescription] = useState(movement.description ?? "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qty = movement.type === "ADJUST" ? movement.signed_qty_pcs : movement.qty_pcs;
  const isAdjust = movement.type === "ADJUST";

  async function save() {
    setIsSubmitting(true);
    setError(null);

    const qtyValue = Number(qtyPcs);
    const categoryIdValue = Number(categoryId);

    if (!categoryId || !categoryIdValue) {
      setError("Kategori wajib dipilih.");
      setIsSubmitting(false);
      return;
    }

    if (!isAdjust) {
      if (!qtyValue || qtyValue <= 0) {
        setError("Qty (pcs) wajib > 0.");
        setIsSubmitting(false);
        return;
      }
    }

    const { error: rpcError } = isAdjust
      ? await supabase.rpc("update_stock_movement_metadata", {
          p_id: movement.movement_id,
          p_movement_at: fromLocalInputValue(movementAt),
          p_category_id: categoryIdValue,
          p_description: description || null,
        })
      : await supabase.rpc("update_stock_movement", {
          p_id: movement.movement_id,
          p_movement_at: fromLocalInputValue(movementAt),
          p_type: movementType,
          p_qty_pcs: qtyValue,
          p_category_id: categoryIdValue,
          p_description: description || null,
        });

    if (rpcError) {
      setError(rpcError.message);
      setIsSubmitting(false);
      return;
    }

    if (variant === "page") {
      router.replace("/movements");
    }
    router.refresh();
    onSubmittedAction?.();
  }

  const content = (
    <>
      <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-600 px-3 py-2 text-sm">
        Edit hanya bisa dilakukan dalam 2 hari sejak transaksi dicatat.
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Produk</Label>
          <Input value={movement.product_name} readOnly className="h-9" />
        </div>
        <div className="space-y-2">
          <Label>Jenis Transaksi</Label>
          {isAdjust ? (
            <Input value={movement.type} readOnly className="h-9" />
          ) : (
            <Select
              value={movementType}
              onValueChange={(value) => setMovementType(value === "OUT" ? "OUT" : "IN")}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue>{movementType}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">IN</SelectItem>
                <SelectItem value="OUT">OUT</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label>Qty (pcs)</Label>
          <Input
            value={isAdjust ? String(qty) : qtyPcs}
            onChange={(e) => setQtyPcs(e.target.value)}
            readOnly={isAdjust}
            className="h-9 text-right tabular-nums"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="movementAt">Tanggal/Jam Transaksi</Label>
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
          <Select
            value={categoryId}
            onValueChange={(value) => setCategoryId(value ?? "")}
            disabled={isSubmitting}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue>
                {categoryOptions.find((category) => String(category.id) === categoryId)?.name ?? "Pilih kategori"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Deskripsi</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-24"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </>
  );

  if (variant === "drawer") {
    return <div className="space-y-5">{content}</div>;
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Detail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">{content}</CardContent>
    </Card>
  );
}
