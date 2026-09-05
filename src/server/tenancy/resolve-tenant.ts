import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { env } from "@/config/env";
import { repositories } from "@/server/repositories";
import type { TenantRoutingTarget } from "@/server/repositories/contracts/tenant-repository";

import { TENANT_HOST_HEADER, TENANT_LABEL_HEADER } from "./headers";
import { tenantLabelFromHost } from "./host";
import { getTenantPrisma, type TenantConnection } from "./tenant-prisma";

/**
 * Request-scoped tenant resolution.
 *
 * Middleware has already parsed the host and, if it looked tenant-scoped,
 * forwarded the label. The lookup itself happens here because it needs the
 * master database, which middleware's edge runtime cannot reach.
 */

export type TenantResolution =
  | { readonly kind: "platform" }
  | { readonly kind: "unknown-tenant"; readonly label: string }
  | {
      readonly kind: "suspended";
      readonly label: string;
      readonly target: TenantRoutingTarget;
    }
  | {
      readonly kind: "not-provisioned";
      readonly label: string;
      readonly target: TenantRoutingTarget;
    }
  | {
      readonly kind: "tenant";
      readonly label: string;
      readonly target: TenantRoutingTarget;
    };

/** Statuses whose tenants must not be served, whatever their host says. */
const SERVABLE = new Set(["active", "trial"]);

/**
 * `cache` dedupes this within a single request, so a layout and the page it
 * wraps resolve the tenant once rather than querying per component.
 */
export const resolveTenant = cache(async (): Promise<TenantResolution> => {
  const headerList = await headers();

  // Prefer the label middleware derived; fall back to parsing the host here so
  // the resolution is still correct if middleware did not run for this path.
  const label =
    headerList.get(TENANT_LABEL_HEADER) ??
    tenantLabelFromHost(
      headerList.get(TENANT_HOST_HEADER) ?? headerList.get("host") ?? "",
      env.TENANT_ROOT_DOMAIN,
    );

  if (!label) return { kind: "platform" };

  const target = await repositories.tenants.findRoutingTargetBySubdomain(label);

  if (!target) return { kind: "unknown-tenant", label };

  // A suspended or pending tenant keeps its host but is not served from it.
  if (!SERVABLE.has(target.approvalStatus)) {
    return { kind: "suspended", label, target };
  }

  if (!target.provisioned) {
    return { kind: "not-provisioned", label, target };
  }

  return { kind: "tenant", label, target };
});

/**
 * The tenant's own database client for this request, or a failure reason.
 *
 * Never falls back to the master database: serving master data on a tenant host
 * would leak every tenant's records at once.
 */
export async function tenantDatabase(): Promise<
  TenantConnection | { readonly ok: false; readonly reason: "no-tenant" }
> {
  const resolution = await resolveTenant();

  if (resolution.kind !== "tenant") {
    return { ok: false, reason: "no-tenant" };
  }

  return getTenantPrisma({
    tenantId: resolution.target.tenantId,
    databaseName: resolution.target.databaseName,
    host: resolution.target.host,
    port: resolution.target.port,
    username: resolution.target.username,
    secretReference: resolution.target.secretReference,
  });
}
