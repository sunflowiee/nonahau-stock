import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";

import { WIB_TZ } from "@/lib/date";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CSV_HEADERS = [
  "movement_at_wib",
  "product",
  "type",
  "qty_pcs",
  "category",
  "description",
  "created_at",
  "updated_at",
] as const;

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  // Escape double quotes by doubling them.
  const escaped = s.replaceAll('"', '""');
  return `"${escaped}"`;
}

function toCsv(
  rows: Array<Record<string, unknown>>,
  headers: readonly string[] = CSV_HEADERS
): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

function isValidDateParam(value: string | null) {
  if (!value) return true;
  return !Number.isNaN(new Date(value).getTime());
}

function buildFilename(from: string | null, to: string | null) {
  if (!from && !to) {
    return "nonahau-movements-all-time.csv";
  }

  const parts: string[] = [];

  if (from) {
    parts.push(`from-${formatInTimeZone(new Date(from), WIB_TZ, "yyyy-MM-dd")}`);
  }

  if (to) {
    parts.push(`to-${formatInTimeZone(new Date(to), WIB_TZ, "yyyy-MM-dd")}`);
  }

  return `nonahau-movements-${parts.join("_")}.csv`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const product = url.searchParams.get("product");
  const type = url.searchParams.get("type");
  const category = url.searchParams.get("category");
  const only = url.searchParams.get("only");

  if (!isValidDateParam(from)) {
    return NextResponse.json({ error: "Parameter from tidak valid." }, { status: 400 });
  }

  if (!isValidDateParam(to)) {
    return NextResponse.json({ error: "Parameter to tidak valid." }, { status: 400 });
  }

  if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
    return NextResponse.json({ error: "Rentang waktu export tidak valid." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  let q = supabase
    .from("v_stock_movements_export")
    .select(
      "movement_at,product_name,type,qty_pcs,category_name,description,created_at,updated_at,product_id,category_id"
    )
    .order("movement_at", { ascending: true });

  if (from) q = q.gte("movement_at", from);
  if (to) q = q.lte("movement_at", to);
  if (product) q = q.eq("product_id", Number(product));
  if (category) q = q.eq("category_id", Number(category));

  if (only === "inout") {
    q = q.in("type", ["IN", "OUT"]);
  } else if (type) {
    q = q.eq("type", type);
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  type Row = {
    movement_at: string;
    product_name: string;
    type: "IN" | "OUT" | "ADJUST";
    qty_pcs: number;
    category_name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  };

  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const movementAt = formatInTimeZone(new Date(r.movement_at), WIB_TZ, "yyyy-MM-dd HH:mm");
    return {
      movement_at_wib: movementAt,
      product: r.product_name,
      type: r.type,
      qty_pcs: r.qty_pcs,
      category: r.category_name,
      description: r.description ?? "",
      created_at: formatInTimeZone(new Date(r.created_at), WIB_TZ, "yyyy-MM-dd HH:mm"),
      updated_at: formatInTimeZone(new Date(r.updated_at), WIB_TZ, "yyyy-MM-dd HH:mm"),
    };
  });

  const csv = `\uFEFF${toCsv(rows, CSV_HEADERS)}`;

  const filename = buildFilename(from, to);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
