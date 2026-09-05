import "server-only";

import type { PlatformPermission } from "@/constants/permissions";
import { apiError, apiFailure } from "@/server/api/http";
import { hasPermission } from "@/server/auth/authorization";
import { getCurrentBoAdmin } from "@/server/auth/session";
import type { BoSessionAdmin } from "@/server/auth/types";

export type ApiAuthorization =
  | { readonly ok: true; readonly admin: BoSessionAdmin }
  | { readonly ok: false; readonly response: Response };

/**
 * Deny-by-default guard for REST routes.
 *
 * `requirePermission` redirects on failure, which is the right answer for a
 * page and the wrong one for an API: a fetch client would follow the redirect
 * and receive the login page with a 200. This guard reports 401 or 403 and
 * lets the caller decide, but applies exactly the same permission rule.
 */
export async function authorizeApiRequest(
  permission: PlatformPermission,
): Promise<ApiAuthorization> {
  let admin: BoSessionAdmin | null;

  try {
    admin = await getCurrentBoAdmin();
  } catch (error: unknown) {
    return {
      ok: false,
      response: apiFailure("Unable to resolve the BO session.", error),
    };
  }

  if (!admin) {
    return {
      ok: false,
      response: apiError("Sign in to use this endpoint.", 401),
    };
  }

  if (!hasPermission(admin.role, permission)) {
    return {
      ok: false,
      response: apiError("Your role does not allow this action.", 403),
    };
  }

  return { ok: true, admin };
}
