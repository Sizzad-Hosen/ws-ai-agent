import "server-only";

import { prisma } from "@/server/db/prisma";
import {
  resolveTenant,
  type ResolvedTenant,
} from "@/server/tenancy/resolve-tenant";

/**
 * Walking every tenant that has a catalogue to sync.
 *
 * This exists because of the shape of this application rather than the shape of
 * the problem: there is no single `embedding_jobs` table to drain. Each tenant
 * has its own database and therefore its own queue, so one sync pass is a loop
 * over tenants, each with its own connection. The compensation is that a
 * tenant's backlog cannot starve another's, and a tenant whose database is
 * unreachable does not stop the rest.
 */

export interface FleetMember {
  readonly slug: string;
  readonly tenant: ResolvedTenant;
}

export interface UnavailableMember {
  readonly slug: string;
  readonly reason: string;
}

export interface Fleet {
  readonly members: readonly FleetMember[];
  readonly unavailable: readonly UnavailableMember[];
}

/**
 * Every servable tenant, resolved.
 *
 * Uses the same resolver the storefront does, so a tenant that is suspended,
 * unprovisioned or unreachable is reported rather than half-synced — and so
 * there is exactly one code path in the application that turns a slug into a
 * database connection.
 */
export async function resolveFleet(only?: string | null): Promise<Fleet> {
  const slug = only?.trim().toLowerCase();

  const tenants = await prisma.tenant.findMany({
    where: {
      ...(slug ? { subdomain: slug } : {}),
      subdomain: slug ? slug : { not: null },
      approvalStatus: { in: ["ACTIVE", "TRIAL"] },
      database: { status: "READY" },
    },
    select: { subdomain: true },
    orderBy: { subdomain: "asc" },
  });

  const members: FleetMember[] = [];
  const unavailable: UnavailableMember[] = [];

  for (const { subdomain } of tenants) {
    if (!subdomain) continue;

    const resolution = await resolveTenant(subdomain);

    if (resolution.ok) {
      members.push({ slug: subdomain, tenant: resolution.tenant });
    } else {
      unavailable.push({ slug: subdomain, reason: resolution.reason });
    }
  }

  return { members, unavailable };
}
