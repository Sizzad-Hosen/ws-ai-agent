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

/**
 * The password every tenant owner's account is created with.
 *
 * Deliberately weak and deliberately shared, at the product owner's direction,
 * so an owner can be told their sign-in over the phone. The account is created
 * INVITED rather than ACTIVE, which forces a change before the dashboard can be
 * reached — but until that change happens, anyone who knows the owner's email
 * address can sign in as them. That window is the cost of this choice.
 */
export const TENANT_DEFAULT_PASSWORD = "12345678";

/** Shortest password an owner may replace the default with. */
export const TENANT_MIN_PASSWORD_LENGTH = 8;

export interface TenantSessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  /** URL of the profile picture, or null when none has been uploaded. */
  readonly avatarUrl: string | null;
  /**
   * True while the account still holds the password it was created with.
   * Tracked as `status = INVITED`, which already means "created, setup not
   * finished" — so this needs no column of its own and works for every tenant
   * database already provisioned.
   */
  readonly mustChangePassword: boolean;
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

  // INVITED signs in; it just cannot go anywhere except the change-password
  // screen. SUSPENDED cannot sign in at all.
  const signInAllowed = user?.status === "ACTIVE" || user?.status === "INVITED";

  if (!user || !signInAllowed || !passwordMatches) {
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
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
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
    if (session.user.status === "SUSPENDED") return null;

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      avatarUrl: session.user.avatarUrl,
      mustChangePassword: session.user.status === "INVITED",
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

export type ChangePasswordOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "wrong-password" | "same-password" };

/**
 * Replaces a tenant user's password and completes their account.
 *
 * Every other session is revoked: if the default password was used by someone
 * else before the owner got here, changing it has to end their access too, or
 * the change achieves nothing.
 */
export async function changeTenantPassword(
  tenant: ResolvedTenant,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordOutcome> {
  const user = await tenant.db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user || !(await compare(currentPassword, user.passwordHash))) {
    return { ok: false, reason: "wrong-password" };
  }

  if (await compare(newPassword, user.passwordHash)) {
    return { ok: false, reason: "same-password" };
  }

  await tenant.db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashTenantPassword(newPassword),
      status: "ACTIVE",
    },
  });

  await tenant.db.userSession.deleteMany({ where: { userId } });

  return { ok: true };
}
