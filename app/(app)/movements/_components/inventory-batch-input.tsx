"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { WIB_TZ } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Product = {
  id: number;
  name: string;
};

type Category = {
  id: number;
  name: string;
};

type ExistingRow = {
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

type MovementType = "IN" | "OUT";

type DraftRow = {
  id: string;
  type: MovementType;
  qtyPcs: string;
  categoryId: string;
  movementAt: string;
  description: string;
};

type PreparedRow = {
  id: string;
  type: MovementType;
  qty: number;
  categoryId: number;
  movementAt: string;
  description: string;
};

function toLocalInputValue(d: Date) {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(localValue: string) {
  return new Date(localValue).toISOString();
}

function createDraftRow(seed?: Partial<Omit<DraftRow, "id">>): DraftRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: seed?.type ?? "IN",
    qtyPcs: seed?.qtyPcs ?? "",
    categoryId: seed?.categoryId ?? "",
    movementAt: seed?.movementAt ?? toLocalInputValue(new Date()),
    description: seed?.description ?? "",
  };
}

function typeBadgeVariant(type: ExistingRow["type"]) {
  if (type === "IN") return "secondary";
  if (type === "OUT") return "default";
  return "outline";
}

function isWithin2Days(createdAtIso: string) {
  const createdAt = new Date(createdAtIso).getTime();
  const now = Date.now();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  return now <= createdAt + twoDaysMs;
}

const inlineFieldClassName =
  "h-7 border-transparent bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent";

export function InventoryBatchInput({
  product,
  categories,
  existingRows,
}: {
  product: Product;
  categories: Category[];
  existingRows: ExistingRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const defaultCategoryId = categories[0] ? String(categories[0].id) : "";

  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canCreateRows = categories.length > 0;

  function addRow() {
    setError(null);
    setSuccess(null);
    setDraftRows((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        createDraftRow({
          type: last?.type ?? "IN",
          categoryId: last?.categoryId ?? defaultCategoryId,
          movementAt: last?.movementAt ?? toLocalInputValue(new Date()),
        }),
      ];
    });
  }

  function removeRow(id: string) {
    setDraftRows((prev) => prev.filter((row) => row.id !== id));
  }

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setDraftRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function saveRows() {
    setError(null);
    setSuccess(null);

    if (draftRows.length === 0) {
      setError("Tambahkan minimal satu row dulu.");
      return;
    }

    let prepared: PreparedRow[];

    try {
      prepared = draftRows.map((row, index) => {
        const qty = Number(row.qtyPcs);
        if (!row.categoryId) {
          throw new Error(`Kategori pada row ${index + 1} wajib dipilih.`);
        }
        if (!row.movementAt) {
          throw new Error(`Tanggal/jam pada row ${index + 1} wajib diisi.`);
        }
        if (!qty || qty <= 0) {
          throw new Error(`Qty pada row ${index + 1} harus lebih dari 0.`);
        }

        return {
          id: row.id,
          type: row.type,
          qty,
          categoryId: Number(row.categoryId),
          movementAt: row.movementAt,
          description: row.description,
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Data input belum valid.");
      return;
    }

    setIsSubmitting(true);

    let savedCount = 0;

    try {
      for (const row of prepared) {
        const { error: rpcError } = await supabase.rpc("create_stock_movement", {
          p_movement_at: fromLocalInputValue(row.movementAt),
          p_product_id: product.id,
          p_type: row.type,
          p_qty_pcs: row.qty,
          p_adjust_sign: null,
          p_adjust_kind: null,
          p_correction_for_movement_id: null,
          p_category_id: row.categoryId,
          p_description: row.description || null,
        });

        if (rpcError) {
          const remainingIds = prepared.slice(savedCount).map((item) => item.id);
          setDraftRows((prev) => prev.filter((item) => remainingIds.includes(item.id)));
          setError(
            savedCount > 0
              ? `Row ${savedCount + 1} gagal: ${rpcError.message}. Row sebelumnya sudah tersimpan.`
              : `Row 1 gagal: ${rpcError.message}`
          );
          router.refresh();
          return;
        }

        savedCount += 1;
      }

      setDraftRows([]);
      setSuccess(`${savedCount} row berhasil disimpan.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat menyimpan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-sm font-medium">Tracking stok</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Riwayat stok produk {product.name} dan input row baru ditampilkan dalam satu tabel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={!canCreateRows || isSubmitting}>
            Tambah
          </Button>
          <Button type="button" size="sm" onClick={saveRows} disabled={draftRows.length === 0 || isSubmitting}>
            {isSubmitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
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

        {!canCreateRows ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Belum ada kategori aktif. Tambahkan kategori dulu di halaman {" "}
            <Link href="/categories" className="font-medium text-foreground underline underline-offset-4">
              Kategori
            </Link>
            .
          </div>
        ) : null}

        <div className="rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9 text-xs text-muted-foreground">Waktu</TableHead>
                <TableHead className="h-9 text-xs text-muted-foreground">Tipe</TableHead>
                <TableHead className="h-9 text-right text-xs text-muted-foreground">Qty</TableHead>
                <TableHead className="h-9 text-xs text-muted-foreground">Kategori</TableHead>
                <TableHead className="h-9 text-xs text-muted-foreground">Deskripsi</TableHead>
                <TableHead className="h-9 text-right text-xs text-muted-foreground">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftRows.map((row) => (
                <TableRow key={row.id} className="bg-muted/25 hover:bg-muted/25">
                  <TableCell className="w-52">
                    <Input
                      type="datetime-local"
                      value={row.movementAt}
                      onChange={(e) => updateRow(row.id, { movementAt: e.target.value })}
                      className={inlineFieldClassName}
                      disabled={isSubmitting}
                    />
                  </TableCell>

                  <TableCell className="w-28">
                    <Select
                      value={row.type}
                      onValueChange={(value) => updateRow(row.id, { type: value === "OUT" ? "OUT" : "IN" })}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-7 w-full border-transparent bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
                      >
                        <SelectValue placeholder="Tipe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN">IN</SelectItem>
                        <SelectItem value="OUT">OUT</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="w-28">
                    <Input
                      inputMode="numeric"
                      value={row.qtyPcs}
                      onChange={(e) => updateRow(row.id, { qtyPcs: e.target.value })}
                      placeholder="0"
                      className={`${inlineFieldClassName} text-right tabular-nums`}
                      disabled={isSubmitting}
                    />
                  </TableCell>

                  <TableCell className="min-w-40">
                    <Select
                      value={row.categoryId}
                      onValueChange={(value) => updateRow(row.id, { categoryId: value ?? "" })}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-7 w-full border-transparent bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
                      >
                        <SelectValue placeholder="Kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={String(category.id)}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="min-w-56">
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(row.id, { description: e.target.value })}
                      placeholder="Opsional"
                      className={inlineFieldClassName}
                      disabled={isSubmitting}
                    />
                  </TableCell>

                  <TableCell className="w-20 text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(row.id)} disabled={isSubmitting}>
                      Batal
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {existingRows.length === 0 && draftRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Belum ada tracking untuk produk ini.
                  </TableCell>
                </TableRow>
              ) : null}

              {existingRows.map((row) => {
                const canEdit = isWithin2Days(row.created_at);
                const qty = row.type === "ADJUST" ? row.signed_qty_pcs : row.qty_pcs;
                return (
                  <TableRow key={row.movement_id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatInTimeZone(new Date(row.movement_at), WIB_TZ, "dd MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeBadgeVariant(row.type)}>{row.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{qty}</TableCell>
                    <TableCell className="text-sm">{row.category_name}</TableCell>
                    <TableCell className="max-w-105 truncate text-sm text-muted-foreground">
                      {row.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/movements/${row.movement_id}/edit`}
                        className={buttonVariants({ variant: "outline", size: "sm" }) + (!canEdit ? " pointer-events-none opacity-50" : "")}
                        aria-disabled={!canEdit}
                        tabIndex={!canEdit ? -1 : 0}
                      >
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
