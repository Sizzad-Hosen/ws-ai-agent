import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { createSecretProvider, type SecretProvider } from "./secrets";

/**
 * Per-tenant database connections.
 *
 * Each tenant has its own database (`tenant_databases`), so a request scoped to
 * a tenant needs a client pointed at that database. Two things make this more
 * than a factory call:
 *
 *  - A `PrismaClient` owns a connection pool. Creating one per request would
 *    exhaust Postgres connections within seconds, so clients are cached per
 *    tenant and evicted when idle.
 *  - Credentials live behind a secret manager (S-03). A connection that cannot
 *    resolve its secret is never attempted.
 */

export interface TenantDatabaseTarget {
  readonly tenantId: string;
  readonly databaseName: string;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly secretReference: string;
}

export type TenantConnection =
  | { readonly ok: true; readonly prisma: PrismaClient }
  | { readonly ok: false; readonly reason: TenantConnectionFailure };

export type TenantConnectionFailure =
  "not-provisioned" | "secret-unavailable" | "connect-failed";

interface CacheEntry {
  readonly prisma: PrismaClient;
  /** Fingerprint of the target; a changed host or secret invalidates the entry. */
  readonly signature: string;
  lastUsedAt: number;
}

/** Cap on distinct tenant pools held open at once. */
const MAX_CLIENTS = 25;
const IDLE_TTL_MS = 5 * 60 * 1000;

const globalForTenancy = globalThis as unknown as {
  tenantClients?: Map<string, CacheEntry>;
  tenantSecrets?: SecretProvider;
};

const clients: Map<string, CacheEntry> = (globalForTenancy.tenantClients ??=
  new Map());

function secretProvider(): SecretProvider {
  return (globalForTenancy.tenantSecrets ??= createSecretProvider(
    process.env.NODE_ENV ?? "development",
    process.env.TENANT_DB_SECRETS_JSON,
  ));
}

function signatureOf(target: TenantDatabaseTarget): string {
  return [
    target.host,
    target.port,
    target.databaseName,
    target.username,
    target.secretReference,
  ].join("|");
}

function buildConnectionString(
  target: TenantDatabaseTarget,
  password: string,
): string {
  const template = process.env.TENANT_DATABASE_URL_TEMPLATE;

  if (template) {
    return template
      .replaceAll("{{host}}", target.host)
      .replaceAll("{{port}}", String(target.port))
      .replaceAll("{{database}}", target.databaseName)
      .replaceAll("{{username}}", encodeURIComponent(target.username))
      .replaceAll("{{password}}", encodeURIComponent(password));
  }

  const user = encodeURIComponent(target.username);
  const secret = encodeURIComponent(password);

  return `postgresql://${user}:${secret}@${target.host}:${target.port}/${target.databaseName}`;
}

async function evict(key: string): Promise<void> {
  const entry = clients.get(key);
  if (!entry) return;

  clients.delete(key);
  // Disconnect failures are not actionable; the entry is gone either way.
  await entry.prisma.$disconnect().catch(() => undefined);
}

/** Closes pools idle beyond the TTL, and the least recent if over the cap. */
async function reap(): Promise<void> {
  const now = Date.now();

  for (const [key, entry] of clients) {
    if (now - entry.lastUsedAt > IDLE_TTL_MS) {
      await evict(key);
    }
  }

  while (clients.size > MAX_CLIENTS) {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;

    for (const [key, entry] of clients) {
      if (entry.lastUsedAt < oldestAt) {
        oldestAt = entry.lastUsedAt;
        oldestKey = key;
      }
    }

    if (oldestKey === null) break;
    await evict(oldestKey);
  }
}

export async function getTenantPrisma(
  target: TenantDatabaseTarget,
): Promise<TenantConnection> {
  await reap();

  const signature = signatureOf(target);
  const cached = clients.get(target.tenantId);

  if (cached) {
    // A rotated secret or moved host must not keep serving the old pool.
    if (cached.signature === signature) {
      cached.lastUsedAt = Date.now();
      return { ok: true, prisma: cached.prisma };
    }
    await evict(target.tenantId);
  }

  const password = await secretProvider().resolve(target.secretReference);

  if (password === null) {
    return { ok: false, reason: "secret-unavailable" };
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: buildConnectionString(target, password),
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      // Per-tenant pools are small: many tenants share one Postgres server.
      max: 5,
    }),
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error: unknown) {
    // Never log the error verbatim; a connection error can echo the DSN.
    console.error(
      `Tenant database connection failed for tenant ${target.tenantId}.`,
      error instanceof Error ? error.message : "unknown error",
    );
    await prisma.$disconnect().catch(() => undefined);
    return { ok: false, reason: "connect-failed" };
  }

  clients.set(target.tenantId, {
    prisma,
    signature,
    lastUsedAt: Date.now(),
  });

  return { ok: true, prisma };
}

/** Drops a tenant's pool, e.g. after its credentials rotate. */
export async function releaseTenantPrisma(tenantId: string): Promise<void> {
  await evict(tenantId);
}

export function tenantPoolSize(): number {
  return clients.size;
}
