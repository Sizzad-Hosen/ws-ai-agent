import type { ReactNode } from "react";

/**
 * Shell for tenant storefronts.
 *
 * Deliberately bare. Tenant sites are served from the platform's own root
 * (`/clickeibazar`), so without a layout of their own they would inherit the
 * marketing site's header and footer and read as Ordivex pages selling Ordivex.
 * A tenant's site belongs to the tenant.
 */
export default function TenantLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <div className="bg-ps-page text-ps-ink flex min-h-screen flex-col font-sans">
      {children}
    </div>
  );
}
