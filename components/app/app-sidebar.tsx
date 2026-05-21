"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, ClipboardList, Tags } from "lucide-react";

import { signOutAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: BarChart3,
  },
  {
    href: "/movements",
    label: "Transaksi",
    icon: ClipboardList,
  },
  {
    href: "/products",
    label: "Produk",
    icon: Boxes,
  },
  {
    href: "/categories",
    label: "Kategori",
    icon: Tags,
  },
];

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-dvh flex-col px-4 py-5">
      <div className="px-2">
        <div className="text-sm font-medium tracking-tight">Nonahau Stock</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Pencatatan stok dimsum
        </div>
      </div>

      <Separator className="my-4" />

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <Separator className="my-4" />
        <div className="px-2">
          <div className="truncate text-xs text-muted-foreground">{userEmail}</div>
          <form action={signOutAction} className="mt-2">
            <Button type="submit" variant="outline" className="w-full justify-center">
              Keluar
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
