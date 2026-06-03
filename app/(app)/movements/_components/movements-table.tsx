"use client";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WIB_TZ } from "@/lib/date";

type Row = {
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

function typeBadgeVariant(type: Row["type"]) {
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

export function MovementsTable({
  rows,
  emptyMessage = "Tidak ada data.",
  showProductColumn = true,
}: {
  rows: Row[];
  emptyMessage?: string;
  showProductColumn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Waktu</TableHead>
            {showProductColumn ? <TableHead>Produk</TableHead> : null}
            <TableHead>Tipe</TableHead>
            <TableHead className="text-right">Qty (pcs)</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Deskripsi</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showProductColumn ? 7 : 6} className="py-10 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const canEdit = isWithin2Days(r.created_at);
              const qty = r.type === "ADJUST" ? r.signed_qty_pcs : r.qty_pcs;
              return (
                <TableRow key={r.movement_id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatInTimeZone(new Date(r.movement_at), WIB_TZ, "dd MMM yyyy, HH:mm")}
                  </TableCell>
                  {showProductColumn ? <TableCell className="font-medium">{r.product_name}</TableCell> : null}
                  <TableCell>
                    <Badge variant={typeBadgeVariant(r.type)}>{r.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{qty}</TableCell>
                  <TableCell className="text-sm">{r.category_name}</TableCell>
                  <TableCell className="max-w-105 truncate text-sm text-muted-foreground">
                    {r.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/movements/${r.movement_id}/edit`}
                      className={buttonVariants({ variant: "outline", size: "sm" }) + (!canEdit ? " pointer-events-none opacity-50" : "")}
                      aria-disabled={!canEdit}
                      tabIndex={!canEdit ? -1 : 0}
                    >
                      Edit
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
