import "server-only";

import { headers } from "next/headers";

import { prisma } from "@/server/db/prisma";

/**
 * Sliding-window throttle for admin sign-in.
 *
 * Two keys, because they catch different attacks: the email key stops a slow
 * grind against one account, the address key stops a spray across many. Only
 * failures are recorded, and a success clears the email's history, so someone
 * who mistypes twice and then gets in is not penalised.
 *
 * Deliberately not a lockout flag on the account: a permanent per-account lock
 * hands anyone a way to deny service to a named administrator just by guessing
 * badly on their behalf.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_EMAIL = 10;
/** Higher, because a shared office NAT is one address for many people. */
const MAX_PER_ADDRESS = 30;

export interface ThrottleDecision {
  readonly allowed: boolean;
  /** Seconds until the window frees up; 0 when allowed. */
  readonly retryAfterSeconds: number;
}

const ALLOWED: ThrottleDecision = { allowed: true, retryAfterSeconds: 0 };

function emailKey(email: string): string {
  return `email:${email.trim().toLowerCase()}`.slice(0, 200);
}

function addressKey(address: string): string {
  return `ip:${address}`.slice(0, 200);
}

/**
 * The client address, as far as it can be trusted.
 *
 * `x-forwarded-for` is client-controlled unless a proxy overwrites it, so this
 * is a throttling aid and not an identity. The email key carries the weight.
 */
export async function clientAddress(): Promise<string | null> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");

  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 100);
  }

  return headerList.get("x-real-ip")?.slice(0, 100) ?? null;
}

async function countSince(
  identifiers: readonly string[],
  since: Date,
): Promise<Map<string, number>> {
  const rows = await prisma.loginAttempt.groupBy({
    by: ["identifier"],
    where: { identifier: { in: [...identifiers] }, createdAt: { gte: since } },
    _count: { identifier: true },
  });

  return new Map(rows.map((row) => [row.identifier, row._count.identifier]));
}

export async function checkLoginAllowed(
  email: string,
  address: string | null,
): Promise<ThrottleDecision> {
  const since = new Date(Date.now() - WINDOW_MS);
  const keys = [emailKey(email), ...(address ? [addressKey(address)] : [])];

  let counts: Map<string, number>;

  try {
    counts = await countSince(keys, since);
  } catch (error: unknown) {
    // The throttle must not become an outage. A failure here is logged and the
    // attempt proceeds; the credential check is still the real gate.
    console.error("Unable to read login attempt history.", error);
    return ALLOWED;
  }

  const overEmail = (counts.get(emailKey(email)) ?? 0) >= MAX_PER_EMAIL;
  const overAddress =
    address !== null &&
    (counts.get(addressKey(address)) ?? 0) >= MAX_PER_ADDRESS;

  if (overEmail || overAddress) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
    };
  }

  return ALLOWED;
}

export async function recordFailedLogin(
  email: string,
  address: string | null,
): Promise<void> {
  const rows = [
    { identifier: emailKey(email) },
    ...(address ? [{ identifier: addressKey(address) }] : []),
  ];

  try {
    await prisma.loginAttempt.createMany({ data: rows });
  } catch (error: unknown) {
    console.error("Unable to record a failed login attempt.", error);
  }
}

/** Clears an email's history so a legitimate user starts clean after signing in. */
export async function clearLoginAttempts(email: string): Promise<void> {
  try {
    await prisma.loginAttempt.deleteMany({
      where: { identifier: emailKey(email) },
    });
  } catch (error: unknown) {
    console.error("Unable to clear login attempt history.", error);
  }
}

/** Drops rows outside the window; safe to call from a scheduled sweep. */
export async function purgeExpiredLoginAttempts(): Promise<number> {
  const result = await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - WINDOW_MS) } },
  });

  return result.count;
}
