import "server-only";

import { isReservedTenantSlug } from "@/constants/reserved-slugs";
import { repositories } from "@/server/repositories";
import {
  getTenantPrisma,
  type TenantPrismaClient,
} from "@/server/tenancy/tenant-prisma";

/**
 * Turning a URL segment into a tenant database connection.
 *
 * This is the single chokepoint for tenant isolation, and every tenant-scoped
 * page, action and route handler goes through it. The rule it enforces: the
 * slug in the URL selects *which* tenant is being asked for, and never *that*
 * the caller may have it. Authorisation is a separate step, decided from the
 * session, and `authorizeTenantAccess` is what performs it.
 *
 * The connection returned is the tenant's own database. No query made through
 * it can reach the master database or another tenant, because it is a different
 * connection to a different database with a client that has no models for
 * anything else.
 */

export type TenantResolution =
  | { readonly ok: true; readonly tenant: ResolvedTenant }
  | { readonly ok: false; readonly reason: TenantResolutionFailure };

export type TenantResolutionFailure =
  /** No tenant claims this slug, or the slug is a platform path. */
  | "unknown-tenant"
  /** The tenant exists but is suspended, rejected or archived. */
  | "tenant-inactive"
  /** The database has not finished provisioning, or provisioning failed. */
  | "not-provisioned"
  /** The credential could not be resolved, so no connection was attempted. */
  | "secret-unavailable"
  /** The database is provisioned but did not accept a connection. */
  | "connect-failed";

export interface ResolvedTenant {
  readonly id: string;
  readonly slug: string;
  readonly businessName: string;
  /** Scoped to this tenant's database. Never the master client. */
  readonly db: TenantPrismaClient;
}

/**
 * Resolves a slug to a connected tenant database.
 *
 * Deliberately says nothing about who is asking. Callers must pair it with
 * {@link assertTenantAccess}; a resolution on its own is not permission.
 */
export async function resolveTenant(slug: string): Promise<TenantResolution> {
  const normalized = slug.trim().toLowerCase();

  // A reserved slug is a platform path, so it can never name a tenant. Checked
  // before the database is touched: a lookup for "bo" should not happen at all.
  if (normalized === "" || isReservedTenantSlug(normalized)) {
    return { ok: false, reason: "unknown-tenant" };
  }

  const target =
    await repositories.tenants.findRoutingTargetBySubdomain(normalized);

  if (!target) {
    return { ok: false, reason: "unknown-tenant" };
  }

  // A suspended workspace is not servable from its own dashboard either. The
  // tenant exists, so this is distinguishable from an unknown slug — but only
  // to the platform, never in what an anonymous caller is told.
  //
  // The verdict and the lifecycle live in separate columns, so both have to
  // say yes: approved but still provisioning is not servable yet, and a
  // suspended workspace is not servable any more.
  if (
    target.approvalStatus !== "approved" ||
    (target.status !== "active" && target.status !== "trial")
  ) {
    return { ok: false, reason: "tenant-inactive" };
  }

  if (!target.provisioned) {
    return { ok: false, reason: "not-provisioned" };
  }

  const connection = await getTenantPrisma({
    tenantId: target.tenantId,
    databaseName: target.databaseName,
    host: target.host,
    port: target.port,
    username: target.username,
    secretReference: target.secretReference,
  });

  if (!connection.ok) {
    return { ok: false, reason: connection.reason };
  }

  return {
    ok: true,
    tenant: {
      id: target.tenantId,
      slug: normalized,
      businessName: target.businessName,
      db: connection.prisma,
    },
  };
}

/** Human-readable cause, for a page that must explain itself. */
export const TENANT_RESOLUTION_MESSAGES: Readonly<
  Record<TenantResolutionFailure, string>
> = {
  "unknown-tenant": "No workspace exists at this address.",
  "tenant-inactive":
    "This workspace is not active. Contact support to restore it.",
  "not-provisioned":
    "This workspace is still being set up. Its database is not ready yet.",
  "secret-unavailable":
    "This workspace's database credentials could not be resolved.",
  "connect-failed": "This workspace's database did not accept a connection.",
};
