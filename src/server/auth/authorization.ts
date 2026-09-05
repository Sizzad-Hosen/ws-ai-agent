import "server-only";

import { redirect } from "next/navigation";

import type { PlatformPermission } from "@/constants/permissions";
import type { PlatformAdminRole } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { can } from "@/features/auth/permissions";
import type { BoSessionAdmin } from "@/server/auth/types";

import { getCurrentBoAdmin } from "./session";

export function hasPermission(
  role: PlatformAdminRole,
  permission: PlatformPermission,
): boolean {
  return can(role, permission);
}

export async function requireBoAdmin(): Promise<BoSessionAdmin> {
  const admin = await getCurrentBoAdmin();

  if (!admin) {
    redirect(ROUTES.auth.login);
  }

  return admin;
}

/**
 * Deny-by-default guard for a single page, action or route handler.
 *
 * Every authenticated surface calls this — the sidebar hiding a link is a
 * convenience, not an access control.
 */
export async function requirePermission(
  permission: PlatformPermission,
): Promise<BoSessionAdmin> {
  const admin = await requireBoAdmin();

  if (!hasPermission(admin.role, permission)) {
    // The permission is deliberately not named in the URL. Nothing rendered it,
    // and it would otherwise reach browser history, referrer headers and any
    // log or analytics pipeline that sees the query string.
    redirect(ROUTES.bo.dashboard);
  }

  return admin;
}
