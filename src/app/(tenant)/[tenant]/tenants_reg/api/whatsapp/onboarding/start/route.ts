import { apiData, apiError, apiFailure } from "@/server/api/http";
import { authorizeTenantRequest } from "@/server/tenancy/tenant-guard";
import { startOnboarding } from "@/server/whatsapp/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opens an Embedded Signup attempt.
 *
 * Deliberately under `/{tenant}/tenants_reg/`, not `/api/`. The tenant session
 * cookie is path-scoped to the workspace root — that is what stops a browser
 * signed into two tenants from sending one's cookie to the other — so a route
 * outside that path never receives it and every request reads as signed out.
 * The endpoint moves to the cookie rather than the cookie widening to the
 * endpoint.
 *
 * The slug comes from the route, and the tenant from the session inside it.
 * There is no tenant id in the request for the same reason as everywhere else
 * here: an id that could be supplied would need a check that the caller owns
 * it, and the check that is never written is the one that is never needed.
 *
 * Returns the app id and configuration id, which the Meta SDK needs in the
 * browser and which are public. The app secret is not returned and is not read
 * on this path.
 */
export async function POST(
  _request: Request,
  context: { readonly params: Promise<{ readonly tenant: string }> },
): Promise<Response> {
  const { tenant: slug } = await context.params;

  const auth = await authorizeTenantRequest(slug);

  if (!auth.ok) return auth.response;

  try {
    const result = await startOnboarding(auth.context.tenant.id);

    if (!result.ok) {
      return apiError(result.error.message, 503);
    }

    return apiData({
      sessionId: result.sessionId,
      stateNonce: result.stateNonce,
      appId: result.appId,
      configId: result.configId,
    });
  } catch (error: unknown) {
    return apiFailure("Unable to start the WhatsApp connection.", error);
  }
}
