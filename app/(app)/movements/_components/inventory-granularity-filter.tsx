"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Granularity } from "@/lib/date";

function setParam(params: URLSearchParams, key: string, value: string | null) {
  const next = new URLSearchParams(params);
  if (!value) next.delete(key);
  else next.set(key, value);
  return next;
}

export function InventoryGranularityFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const requestedGranularity = searchParams.get("granularity") as Granularity | null;
  const granularity = requestedGranularity === "month" || requestedGranularity === "year" ? requestedGranularity : "day";

  return (
    <Tabs
      value={granularity}
      onValueChange={(value) => {
        startTransition(() => {
          const next = setParam(searchParams, "granularity", value);
          router.replace(`${pathname}?${next.toString()}`);
          router.refresh();
        });
      }}
      className={isPending ? "pointer-events-none opacity-70" : undefined}
    >
      <TabsList className="h-9">
        <TabsTrigger value="day">Hari</TabsTrigger>
        <TabsTrigger value="month">Bulan</TabsTrigger>
        <TabsTrigger value="year">Tahun</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
