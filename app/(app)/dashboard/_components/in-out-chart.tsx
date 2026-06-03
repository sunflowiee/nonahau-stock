"use client";

import { useMemo } from "react";
import { format } from "date-fns";

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

function formatBucket(d: Date, granularity: Granularity) {
  if (granularity === "day") return format(d, "dd MMM");
  if (granularity === "month") return format(d, "MMM yy");
  return format(d, "yyyy");
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

  return (
    <div className="h-[280px] min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
        <BarChart data={chartData} margin={{ left: 8, right: 12, top: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            width={48}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              boxShadow: "none",
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Bar
            dataKey="in_qty"
            name="IN"
            fill="var(--chart-1)"
            radius={[6, 6, 0, 0]}
            maxBarSize={24}
          />
          <Bar
            dataKey="out_qty"
            name="OUT"
            fill="var(--chart-3)"
            radius={[6, 6, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-sm" style={{ background: "var(--chart-1)" }} />
          <span>IN</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-sm" style={{ background: "var(--chart-3)" }} />
          <span>OUT</span>
        </div>
      </div>
    </div>
  );
}
