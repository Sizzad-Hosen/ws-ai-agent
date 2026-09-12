import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { TenantHeader } from "@/features/tenant-dashboard/components/tenant-header";
import { TenantSidebar } from "@/features/tenant-dashboard/components/tenant-sidebar";
import type { ResolvedTenant } from "@/server/tenancy/resolve-tenant";
import type { TenantSessionUser } from "@/server/tenancy/tenant-auth";

/**
 * The frame every signed-in tenant page renders inside.
 *
 * Extracted because the sidebar, the header and the main column were being
 * repeated verbatim in each page. A copy per page is how one screen quietly
 * loses the sidebar, or keeps an old one after the navigation changes.
 *
 * It takes the already-resolved tenant and user rather than a slug, so it
 * cannot be rendered without a guard having run first.
 */
export interface TenantShellProps {
  readonly tenant: ResolvedTenant;
  readonly user: TenantSessionUser;
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

export function TenantShell({
  tenant,
  user,
  title,
  description,
  actions,
  children,
}: TenantShellProps) {
  return (
    <div className="flex min-h-screen">
      <TenantSidebar slug={tenant.slug} businessName={tenant.businessName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TenantHeader
          slug={tenant.slug}
          businessName={tenant.businessName}
          user={user}
        />

        <main className="flex-1 space-y-6 p-4 sm:p-6">
          <PageHeader
            title={title}
            description={description}
            actions={actions}
          />
          {children}
        </main>
      </div>
    </div>
  );
}
