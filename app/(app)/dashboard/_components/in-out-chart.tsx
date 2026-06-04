"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { BarChart3 } from "lucide-react";

import type { Granularity } from "@/lib/date";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = {
  bucket_start: string;
  in_qty: number;
  out_qty: number;
};

const IN_COLOR = "#0f766e";
const OUT_COLOR = "#d97706";

function formatBucket(d: Date, granularity: Granularity) {
  if (granularity === "day") return format(d, "dd MMM");
  if (granularity === "month") return format(d, "MMM yy");
  return format(d, "yyyy");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function InOutChart({
  data,
  granularity,
}: {
  data: Row[];
  granularity: Granularity;
}) {
  const chartData = useMemo(() => {
    return data.map((r) => {
      const d = new Date(r.bucket_start);
      return {
        label: formatBucket(d, granularity),
        in_qty: Number(r.in_qty ?? 0),
        out_qty: Number(r.out_qty ?? 0),
      };
    });
  }, [data, granularity]);

  const hasActivity = chartData.some((row) => row.in_qty > 0 || row.out_qty > 0);

  if (!hasActivity) {
    return (
      <div className="flex h-[280px] w-full flex-col items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/15 px-6 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground">
          <BarChart3 className="size-4" />
        </div>
        <div className="mt-4 text-sm font-medium">Belum ada data grafik</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Coba ganti produk atau periode, atau tambahkan transaksi IN/OUT.
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full space-y-3">
      <div className="h-[280px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
        <BarChart data={chartData} margin={{ left: 8, right: 12, top: 8, bottom: 4 }} barGap={10}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickFormatter={(value) => formatNumber(Number(value))}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.10)" }}
            formatter={(value, name) => [`${formatNumber(Number(value ?? 0))} pcs`, String(name)]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(148, 163, 184, 0.18)",
              background: "rgba(255,255,255,0.96)",
              color: "#0f172a",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
            }}
            labelStyle={{ color: "#64748b" }}
          />
          <Bar
            dataKey="in_qty"
            name="IN"
            fill={IN_COLOR}
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="out_qty"
            name="OUT"
            fill={OUT_COLOR}
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-sm" style={{ background: IN_COLOR }} />
          <span>IN</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-sm" style={{ background: OUT_COLOR }} />
          <span>OUT</span>
        </div>
      </div>
    </div>
  );
}
