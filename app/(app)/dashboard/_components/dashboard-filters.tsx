"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Granularity } from "@/lib/date";

type Product = { id: number; name: string };

function setParam(params: URLSearchParams, key: string, value: string | null) {
  const next = new URLSearchParams(params);
  if (!value) next.delete(key);
  else next.set(key, value);
  return next;
}

export function DashboardFilters({ products }: { products: Product[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const product = searchParams.get("product") ?? "all";
  const granularity = (searchParams.get("granularity") as Granularity | null) ?? "day";

  const productLabel = useMemo(() => {
    if (product === "all") return "Semua produk";
    const id = Number(product);
    return products.find((p) => p.id === id)?.name ?? "Produk";
  }, [product, products]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={product}
        onValueChange={(value) => {
          startTransition(() => {
            const next = setParam(searchParams, "product", value === "all" ? null : value);
            router.replace(`${pathname}?${next.toString()}`);
            router.refresh();
          });
        }}
        disabled={isPending}
      >
        <SelectTrigger className="h-9 w-[220px]">
          <SelectValue placeholder={productLabel} />
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

      <Tabs
        value={granularity}
        onValueChange={(value) => {
          startTransition(() => {
            const next = setParam(searchParams, "granularity", value);
            router.replace(`${pathname}?${next.toString()}`);
            router.refresh();
          });
        }}
      >
        <TabsList className="h-9">
          <TabsTrigger value="day">Harian</TabsTrigger>
          <TabsTrigger value="month">Bulanan</TabsTrigger>
          <TabsTrigger value="year">Tahunan</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
