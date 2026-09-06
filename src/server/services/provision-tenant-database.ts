import "server-only";

import { repositories } from "@/server/repositories";
import {
  TENANT_SCHEMA_VERSION,
  provisionTenantDatabase,
  provisionedConnection,
} from "@/server/tenancy/provision-database";
import { localSecretReference } from "@/server/tenancy/secrets";

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

  // The row described an intent while the database did not exist. It exists
  // now, so the pointers are rewritten to name it: a host_reference reading
  // "pending/us-east-1/acme" is not somewhere a connection can be opened.
  const connection = provisionedConnection();

  if (connection) {
    await repositories.provisioning.setDatabaseConnection(tenantId, {
      host: connection.host,
      port: connection.port,
      username: connection.username,
      secretReference: localSecretReference(target.databaseName),
    });
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
