import { notFound } from "next/navigation";

import { MovementEditForm } from "@/app/(app)/movements/[id]/edit/_components/movement-edit-form";
import { LinkButton } from "@/components/app/link-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = { id: string };

type MovementRow = {
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

export default async function MovementEditPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const movementId = Number(id);

  const supabase = await createSupabaseServerClient();

  const [{ data: rows }, { data: categories }] = await Promise.all([
    supabase
      .from("v_stock_movements_export")
      .select(
        "movement_id,movement_at,created_at,product_id,product_name,type,qty_pcs,signed_qty_pcs,category_id,category_name,description"
      )
      .eq("movement_id", movementId)
      .limit(1),
    supabase
      .from("categories")
      .select("id,name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const row = (rows?.[0] as MovementRow | undefined) ?? null;
  if (!row) notFound();



  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Edit Metadata</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kamu hanya bisa mengubah tanggal/jam, kategori, dan deskripsi. Qty/type/produk tidak bisa diubah.
          </p>
        </div>
        <LinkButton href="/movements" variant="outline" className="h-9">
          Kembali
        </LinkButton>
      </header>

      <MovementEditForm movement={row} categories={categories ?? []} />
    </div>
  );
}
