"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Product = { id: number; name: string };
type Category = { id: number; name: string };

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(localValue: string) {
  // Interpreted as local time; toISOString() converts to UTC instant.
  return new Date(localValue).toISOString();
}

export function MovementsFilters({
  products,
  categories,
  initial,
}: {
  products: Product[];
  categories: Category[];
  initial: {
    from: string;
    to: string;
    product: string;
    type: string;
    category: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [from, setFrom] = useState(() => toLocalInputValue(initial.from));
  const [to, setTo] = useState(() => toLocalInputValue(initial.to));
  const [product, setProduct] = useState(initial.product);
  const [type, setType] = useState(initial.type);
  const [category, setCategory] = useState(initial.category);

  const canApply = useMemo(() => {
    return Boolean(from) && Boolean(to);
  }, [from, to]);

  function apply() {
    if (!canApply) return;

    startTransition(() => {
      const next = new URLSearchParams(searchParams);
      next.set("from", fromLocalInputValue(from));
      next.set("to", fromLocalInputValue(to));

      if (product && product !== "all") next.set("product", product);
      else next.delete("product");

      if (type && type !== "all") next.set("type", type);
      else next.delete("type");

      if (category && category !== "all") next.set("category", category);
      else next.delete("category");

      router.replace(`${pathname}?${next.toString()}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr_220px_200px_220px_auto] md:items-end">
      <div className="space-y-2">
        <Label htmlFor="from">Dari</Label>
        <Input
          id="from"
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="to">Sampai</Label>
        <Input
          id="to"
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="space-y-2">
        <Label>Produk</Label>
        <Select value={product} onValueChange={(v) => setProduct(v ?? "all")} disabled={isPending}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Produk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua produk</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Tipe</Label>
        <Select value={type} onValueChange={(v) => setType(v ?? "all")} disabled={isPending}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="IN">IN</SelectItem>
            <SelectItem value="OUT">OUT</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Kategori</Label>
        <Select value={category} onValueChange={(v) => setCategory(v ?? "all")} disabled={isPending}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button className="h-9" onClick={apply} disabled={!canApply || isPending}>
          Terapkan
        </Button>
      </div>
    </div>
  );
}
