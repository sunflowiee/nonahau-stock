import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";

export function AppShell({
  children,
  userEmail,
  userName,
}: {
  children: ReactNode;
  userEmail: string;
  userName?: string | null;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <AppSidebar userEmail={userEmail} userName={userName} />
      <main className="min-h-dvh min-w-0 pl-60">
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
