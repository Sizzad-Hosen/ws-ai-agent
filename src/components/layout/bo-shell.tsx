import type { ReactNode } from "react";

import { BoHeader } from "@/components/layout/bo-header";
import { BoSidebar } from "@/components/layout/bo-sidebar";
import type { BoSessionAdmin } from "@/server/auth/types";

interface BoShellProps {
  readonly admin: BoSessionAdmin;
  readonly allowedHrefs: readonly string[];
  readonly children: ReactNode;
}

export function BoShell({ admin, allowedHrefs, children }: BoShellProps) {
  return (
    <div className="bg-background flex min-h-screen">
      <BoSidebar allowedHrefs={allowedHrefs} />
      <div className="flex min-w-0 flex-1 flex-col">
        <BoHeader admin={admin} notificationCount={3} />
        <main className="container-bo flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
