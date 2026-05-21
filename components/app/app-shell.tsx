import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";

export function AppShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail: string;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-[240px_1fr]">
        <AppSidebar userEmail={userEmail} />
        <main className="min-w-0 border-l border-border/60">
          <div className="px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
