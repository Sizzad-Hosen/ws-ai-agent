import type { Metadata } from "next";

import {
  TENANT_RESOLUTION_MESSAGES,
  type TenantResolutionFailure,
} from "@/server/tenancy/resolve-tenant";

export const metadata: Metadata = {
  title: "Workspace unavailable",
  robots: { index: false, follow: false },
};

const REASONS = Object.keys(
  TENANT_RESOLUTION_MESSAGES,
) as TenantResolutionFailure[];

/**
 * Why a workspace that exists cannot be served.
 *
 * Reached only after the tenant resolved far enough to be known, so explaining
 * discloses nothing an unknown address would not already have 404'd on.
 */
export default async function TenantUnavailablePage({
  params,
  searchParams,
}: PageProps<"/[tenant]/tenants_reg/unavailable">) {
  const { tenant: slug } = await params;
  const query = await searchParams;
  const raw = typeof query.reason === "string" ? query.reason : "";

  const reason = REASONS.includes(raw as TenantResolutionFailure)
    ? (raw as TenantResolutionFailure)
    : "connect-failed";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          This workspace is unavailable
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          {TENANT_RESOLUTION_MESSAGES[reason]}
        </p>
        <p className="text-muted-foreground mt-6 font-mono text-xs">{slug}</p>
      </div>
    </main>
  );
}
