"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { WIB_TZ } from "@/lib/date";
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

type Category = { id: number; name: string };

type Movement = {
  movement_id: number;
  movement_at: string;
  created_at: string;
  product_name: string;
  type: "IN" | "OUT" | "ADJUST";
  qty_pcs: number;
  signed_qty_pcs: number;
  category_id: number;
  description: string | null;
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
}: {
  movement: Movement;
  categories: Category[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [movementAt, setMovementAt] = useState(() => toLocalInputValue(movement.movement_at));
  const [categoryId, setCategoryId] = useState(String(movement.category_id));
  const [description, setDescription] = useState(movement.description ?? "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qty = movement.type === "ADJUST" ? movement.signed_qty_pcs : movement.qty_pcs;

  async function save() {
    setIsSubmitting(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc("update_stock_movement_metadata", {
      p_id: movement.movement_id,
      p_movement_at: fromLocalInputValue(movementAt),
      p_category_id: Number(categoryId),
      p_description: description || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      setIsSubmitting(false);
      return;
    }

    router.replace("/movements");
    router.refresh();
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Detail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          Edit hanya boleh dalam 2 hari sejak transaksi dicatat. Jika lewat, sistem akan menolak saat disimpan.
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Produk</Label>
            <Input value={movement.product_name} readOnly className="h-9" />
          </div>
          <div className="space-y-2">
            <Label>Tipe</Label>
            <Input value={movement.type} readOnly className="h-9" />
          </div>
          <div className="space-y-2">
            <Label>Qty (pcs)</Label>
            <Input value={String(qty)} readOnly className="h-9 text-right tabular-nums" />
          </div>
          <div className="space-y-2">
            <Label>Dibuat</Label>
            <Input
              value={formatInTimeZone(new Date(movement.created_at), WIB_TZ, "dd MMM yyyy, HH:mm")}
              readOnly
              className="h-9"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
              onValueChange={(v) => setCategoryId(v ?? "")}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

        <div className="flex justify-end">
          <Button onClick={save} disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
