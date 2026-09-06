import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";

import { env } from "@/config/env";
import { tenantBasePath } from "@/features/tenant-dashboard/routes";
import type { ResolvedTenant } from "@/server/tenancy/resolve-tenant";

/**
 * Sessions for tenant staff.
 *
 * Two properties do the isolation work here, and neither depends on the URL
 * being honest:
 *
 *  1. The session row lives in the tenant's *own* database. A token minted for
 *     tenant A is not a row in tenant B's `user_sessions`, so presenting it to
 *     tenant B resolves to nobody. Cross-tenant access fails by construction
 *     rather than by a check somebody has to remember to write.
 *  2. The cookie is scoped to the tenant's path, so a browser holding sessions
 *     for two tenants sends each only to its own dashboard.
 *
 * The token is opaque and only its SHA-256 hash is stored, mirroring the master
 * database's admin_sessions. A signed stateless token would be smaller and
 * would also make sign-out, suspension and revocation unenforceable until it
 * expired.
 */

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const REMEMBERED_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/** Cost factor for tenant user passwords, matching the back office. */
const BCRYPT_ROUNDS = 12;

/**
 * Burned on every failed sign-in so a missing account and a wrong password
 * take the same time. Without it, response timing enumerates valid emails.
 */
const dummyHashPromise = hash("invalid-development-credential", BCRYPT_ROUNDS);

export const TENANT_SESSION_COOKIE = "tenant_session";

export interface TenantSessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export function createTenantSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTenantSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashTenantPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

/**
 * Signs a tenant user in against that tenant's own database.
 *
 * Returns null for every failure — unknown email, wrong password, suspended
 * account — because telling the caller which one it was tells an attacker
 * which emails exist.
 */
export async function signInTenantUser(
  tenant: ResolvedTenant,
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<{ token: string; expiresAt: Date } | null> {
  const user = await tenant.db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true, status: true },
  });

  const passwordHash = user?.passwordHash ?? (await dummyHashPromise);
  const passwordMatches = await compare(password, passwordHash);

  if (!user || user.status !== "ACTIVE" || !passwordMatches) {
    return null;
  }

  const token = createTenantSessionToken();
  const expiresAt = new Date(
    Date.now() + (rememberMe ? REMEMBERED_DURATION_MS : SESSION_DURATION_MS),
  );

  await tenant.db.userSession.create({
    data: {
      userId: user.id,
      tokenHash: hashTenantSessionToken(token),
      expiresAt,
    },
  });

  await tenant.db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { token, expiresAt };
}

/**
 * The signed-in user for this tenant, or null.
 *
 * The lookup is scoped to the tenant's database, so a token belonging to
 * another tenant simply does not resolve. An expired or revoked session is
 * treated as absent, and the expired row is removed on the way past.
 */
export async function getCurrentTenantUser(
  tenant: ResolvedTenant,
): Promise<TenantSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TENANT_SESSION_COOKIE)?.value;

  if (!token) return null;

  const tokenHash = hashTenantSessionToken(token);

  try {
    const session = await tenant.db.userSession.findUnique({
      where: { tokenHash },
      select: {
        expiresAt: true,
        revokedAt: true,
        user: {
          select: { id: true, name: true, email: true, status: true },
        },
      },
    });

    if (!session || session.revokedAt !== null) return null;

    if (session.expiresAt <= new Date()) {
      await tenant.db.userSession
        .deleteMany({ where: { tokenHash } })
        .catch(() => undefined);
      return null;
    }

    // A suspended account loses access immediately, not at token expiry.
    if (session.user.status !== "ACTIVE") return null;

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    };
  } catch (error: unknown) {
    console.error("Unable to validate the tenant session.", error);
    return null;
  }
}

export async function setTenantSessionCookie(
  slug: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(TENANT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    // Path-scoped: a browser signed into two tenants sends each cookie only to
    // its own dashboard, so one tenant's session never reaches another.
    path: tenantBasePath(slug),
    expires: expiresAt,
  });
}

export async function clearTenantSession(
  tenant: ResolvedTenant,
): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TENANT_SESSION_COOKIE)?.value;

  if (token) {
    await tenant.db.userSession
      .deleteMany({ where: { tokenHash: hashTenantSessionToken(token) } })
      .catch(() => undefined);
  }

  cookieStore.delete({
    name: TENANT_SESSION_COOKIE,
    path: tenantBasePath(tenant.slug),
  });
}
