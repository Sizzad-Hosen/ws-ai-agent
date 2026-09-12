import "server-only";

import { notFound, redirect } from "next/navigation";

import { apiError, apiFailure } from "@/server/api/http";
import {
  resolveTenant,
  type ResolvedTenant,
  type TenantResolutionFailure,
} from "@/server/tenancy/resolve-tenant";
import { tenantBasePath } from "@/features/tenant-dashboard/routes";
import {
  getCurrentTenantUser,
  type TenantSessionUser,
} from "@/server/tenancy/tenant-auth";

/**
 * The two-step guard every tenant-scoped surface uses.
 *
 * Resolution answers *which* tenant the URL names. Authorisation answers
 * whether the caller holds a session in that tenant's database. They are
 * separate on purpose: a slug in a URL is user input, and treating it as proof
 * of access is exactly the bug this guard exists to make impossible.
 *
 * There is no "is this user allowed this tenant?" comparison anywhere, because
 * there is nothing to compare. The session is looked up in the tenant's own
 * database, so a user of tenant A presenting their cookie to tenant B's
 * dashboard resolves to nobody — the row is not there to find.
 */

export interface TenantContext {
  readonly tenant: ResolvedTenant;
  readonly user: TenantSessionUser;
}

/**
 * Guard for a Server Component page.
 *
 * An unknown tenant is a 404 rather than a redirect: the address names nothing,
 * and saying "sign in to see this" would confirm the workspace exists.
 */
export async function requireTenantPage(
  slug: string,
  options: { readonly allowPasswordChange?: boolean } = {},
): Promise<TenantContext> {
  const resolution = await resolveTenant(slug);

  if (!resolution.ok) {
    if (resolution.reason === "unknown-tenant") notFound();

    // A tenant that exists but cannot be served gets an explaining page, not a
    // silent 404 — its own staff need to know why they cannot get in.
    redirect(`${tenantBasePath(slug)}/unavailable?reason=${resolution.reason}`);
  }

  const user = await getCurrentTenantUser(resolution.tenant);

  if (!user) {
    redirect(`${tenantBasePath(slug)}/login`);
  }

  // An account still on the password it was created with reaches exactly one
  // page. Enforced here rather than in a layout, because a layout does not
  // re-run on every navigation.
  if (user.mustChangePassword && !options.allowPasswordChange) {
    redirect(`${tenantBasePath(slug)}/change-password`);
  }

  return { tenant: resolution.tenant, user };
}

/**
 * Resolves the tenant without requiring a session, for the sign-in page itself.
 */
export async function requireTenantOnly(slug: string): Promise<ResolvedTenant> {
  const resolution = await resolveTenant(slug);

  if (!resolution.ok) {
    if (resolution.reason === "unknown-tenant") notFound();
    redirect(`${tenantBasePath(slug)}/unavailable?reason=${resolution.reason}`);
  }

  return resolution.tenant;
}

export type TenantApiAuthorization =
  | { readonly ok: true; readonly context: TenantContext }
  | { readonly ok: false; readonly response: Response };

/**
 * Guard for a REST route.
 *
 * Reports status codes rather than redirecting: a fetch client would follow a
 * redirect to the login page and receive it with a 200, which reads as success.
 */
export async function authorizeTenantRequest(
  slug: string,
): Promise<TenantApiAuthorization> {
  let resolution;

  try {
    resolution = await resolveTenant(slug);
  } catch (error: unknown) {
    return {
      ok: false,
      response: apiFailure("Unable to resolve the tenant.", error),
    };
  }

  if (!resolution.ok) {
    return { ok: false, response: resolutionResponse(resolution.reason) };
  }

  let user: TenantSessionUser | null;

  try {
    user = await getCurrentTenantUser(resolution.tenant);
  } catch (error: unknown) {
    return {
      ok: false,
      response: apiFailure("Unable to resolve the tenant session.", error),
    };
  }

  if (!user) {
    return {
      ok: false,
      response: apiError("Sign in to use this endpoint.", 401),
    };
  }

  // The same gate as the pages: an account owing a password change cannot
  // reach data through the API either.
  if (user.mustChangePassword) {
    return {
      ok: false,
      response: apiError(
        "Change your password before using this workspace.",
        403,
      ),
    };
  }

  return { ok: true, context: { tenant: resolution.tenant, user } };
}

/**
 * An unknown tenant is 404 and never 403.
 *
 * A 403 would confirm the workspace exists to someone guessing names, which is
 * a membership disclosure even though no data leaks with it.
 */
function resolutionResponse(reason: TenantResolutionFailure): Response {
  switch (reason) {
    case "unknown-tenant":
      return apiError("No workspace exists at this address.", 404);
    case "tenant-inactive":
      return apiError("This workspace is not active.", 403);
    case "not-provisioned":
      return apiError("This workspace is still being set up.", 503);
    default:
      return apiError("This workspace is temporarily unavailable.", 503);
  }
}
