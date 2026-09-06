import "server-only";

import { repositories } from "@/server/repositories";
import {
  TENANT_SCHEMA_VERSION,
  provisionTenantDatabase,
} from "@/server/tenancy/provision-database";

export type TenantDatabaseResult =
  | {
      readonly ok: true;
      readonly databaseName: string;
      readonly created: boolean;
    }
  | { readonly ok: false; readonly reason: string };

/**
 * Creates a tenant's physical database and records how it went.
 *
 * Runs after the master transaction has committed, because `CREATE DATABASE`
 * cannot be part of one. The status column is the record of that gap: the row
 * moves PENDING → PROVISIONING → READY or FAILED, so a database that never
 * arrived shows as failed rather than as a tenant that merely looks finished.
 *
 * Idempotent. An existing database is adopted rather than treated as an error,
 * and the schema is applied with IF NOT EXISTS throughout, so a retry after a
 * partial failure completes the job instead of tripping over its own leftovers.
 */
export async function provisionDatabaseForTenant(
  tenantId: string,
): Promise<TenantDatabaseResult> {
  const target = await repositories.provisioning.findDatabaseTarget(tenantId);

  if (!target) {
    return { ok: false, reason: "This tenant has no database record." };
  }

  await repositories.provisioning.setDatabaseStatus(tenantId, "provisioning");

  const outcome = await provisionTenantDatabase(target.databaseName);

  if (!outcome.ok) {
    await repositories.provisioning.setDatabaseStatus(tenantId, "failed");
    return { ok: false, reason: outcome.reason };
  }

  await repositories.provisioning.setDatabaseStatus(
    tenantId,
    "ready",
    TENANT_SCHEMA_VERSION,
  );

  return {
    ok: true,
    databaseName: target.databaseName,
    created: outcome.created,
  };
}
