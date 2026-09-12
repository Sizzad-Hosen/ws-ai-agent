import "server-only";

import { repositories } from "@/server/repositories";
import {
  TENANT_DEFAULT_PASSWORD,
  hashTenantPassword,
} from "@/server/tenancy/tenant-auth";
import {
  getTenantPrisma,
  type TenantPrismaClient,
} from "@/server/tenancy/tenant-prisma";
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
      /**
       * The owner's first sign-in password, shown once to whoever approved the
       * tenant. Null when the account already existed.
       */
      readonly ownerPassword: string | null;
      readonly ownerEmail: string | null;
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

  const owner = await createOwnerUser(tenantId);

  return {
    ok: true,
    databaseName: target.databaseName,
    created: outcome.created,
    ownerPassword: owner?.password ?? null,
    ownerEmail: owner?.email ?? null,
  };
}

/**
 * Seeds the tenant's first user, so somebody can actually sign in.
 *
 * A workspace nobody can reach is not provisioned, it is stranded — there is
 * no invitation mail in this application and no other way in. The account is
 * the owner from the registration, created with the shared default password
 * and stored only as a bcrypt hash.
 *
 * Returns null when the account already exists, so a retry never resets a
 * password the owner may already have chosen.
 */
async function createOwnerUser(
  tenantId: string,
): Promise<{ email: string; password: string } | null> {
  const tenant = await repositories.tenants.findById(tenantId);

  if (!tenant) return null;

  const resolution = await resolveTenantById(tenantId, tenant.tenantCode);

  if (!resolution) return null;

  const email = tenant.ownerEmail.trim().toLowerCase();
  const existing = await resolution.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) return null;

  await resolution.user.create({
    data: {
      email,
      name: tenant.ownerName,
      passwordHash: await hashTenantPassword(TENANT_DEFAULT_PASSWORD),
      // INVITED, not ACTIVE: the account exists but still holds the password it
      // was created with, and the guard will not let it past the
      // change-password screen until that is replaced.
      status: "INVITED",
    },
  });

  return { email, password: TENANT_DEFAULT_PASSWORD };
}

/**
 * Opens the tenant's client directly from its database row.
 *
 * Not `resolveTenant`: that refuses a tenant whose database is not yet READY,
 * and this runs during the provisioning that makes it READY.
 */
async function resolveTenantById(
  tenantId: string,
  tenantCode: string,
): Promise<{ user: TenantPrismaClient["user"] } | null> {
  const row = await repositories.provisioning.findDatabaseTarget(tenantId);
  const pointers =
    await repositories.provisioning.findDatabasePointers(tenantId);

  if (!row || !pointers) return null;

  const connection = await getTenantPrisma({
    tenantId,
    databaseName: row.databaseName,
    host: pointers.host,
    port: pointers.port,
    username: pointers.username,
    secretReference: pointers.secretReference,
  });

  if (!connection.ok) {
    console.error(
      `Provisioned ${tenantCode} but could not connect to seed its owner: ${connection.reason}.`,
    );
    return null;
  }

  return { user: connection.prisma.user };
}
