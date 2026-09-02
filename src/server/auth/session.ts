import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { env } from "@/config/env";
import { repositories } from "@/server/repositories";
import type { BoSessionAdmin } from "@/server/auth/types";

export const BO_SESSION_COOKIE = "bo_admin_session";

const STANDARD_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const REMEMBERED_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionExpiry(rememberMe: boolean): Date {
  const duration = rememberMe
    ? REMEMBERED_SESSION_DURATION_MS
    : STANDARD_SESSION_DURATION_MS;
  return new Date(Date.now() + duration);
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(BO_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentBoAdmin(): Promise<BoSessionAdmin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(BO_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await repositories.sessions.findByTokenHash(tokenHash);

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await repositories.sessions.deleteByTokenHash(tokenHash);
    }
    return null;
  }

  return session.admin;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(BO_SESSION_COOKIE)?.value;

  if (token) {
    await repositories.sessions.deleteByTokenHash(hashSessionToken(token));
  }

  cookieStore.delete(BO_SESSION_COOKIE);
}
