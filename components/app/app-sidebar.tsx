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
    label: "Inventory",
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

function formatDisplayName(userName: string | null | undefined, userEmail: string) {
  if (userName?.trim()) return userName.trim();

  const localPart = userEmail.split("@")[0] ?? "User";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function AppSidebar({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const displayName = formatDisplayName(userName, userEmail);
  const initials = getInitials(displayName);

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col overflow-y-auto border-r border-border/60 bg-background px-4 py-5">
      <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tracking-tight text-foreground ring-1 ring-border/60">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              {displayName}
            </div>
            <div className="truncate text-xs text-muted-foreground">{userEmail}</div>
          </div>
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
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
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
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full justify-center">
            Keluar
          </Button>
        </form>
      </div>
    </aside>
  );
}
