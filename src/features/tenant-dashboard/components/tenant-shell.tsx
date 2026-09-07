import type { ReactNode } from "react";

import { TenantHeader } from "@/features/tenant-dashboard/components/tenant-header";
import { TenantSidebar } from "@/features/tenant-dashboard/components/tenant-sidebar";
import type { TenantSessionUser } from "@/server/tenancy/tenant-auth";

interface TenantShellProps {
  readonly slug: string;
  readonly businessName: string;
  readonly user: TenantSessionUser;
  readonly children: ReactNode;
}

/**
 * Sidebar, header and content frame for every signed-in dashboard page.
 *
 * A component rather than a layout: the guard runs per page, and the shell
 * needs the tenant and user that guard returns. A layout would have to resolve
 * them a second time, and would not re-run on navigation.
 */
export function TenantShell({
  slug,
  businessName,
  user,
  children,
}: TenantShellProps) {
  return (
    <div className="flex min-h-screen">
      <TenantSidebar slug={slug} businessName={businessName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TenantHeader slug={slug} businessName={businessName} user={user} />
        <main className="flex-1 space-y-6 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
