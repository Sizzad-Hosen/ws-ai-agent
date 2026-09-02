import "server-only";

import type { PlatformPermission } from "@/constants/permissions";
import type { PlatformAdminRole } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { can } from "@/features/auth/permissions";
import type { BoSessionAdmin } from "@/server/auth/types";
import { redirect } from "next/navigation";

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
