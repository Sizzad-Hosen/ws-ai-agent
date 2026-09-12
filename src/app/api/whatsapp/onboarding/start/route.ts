import { apiData, apiError, apiFailure } from "@/server/api/http";
import { authorizeTenantRequest } from "@/server/tenancy/tenant-guard";
import { startOnboarding } from "@/server/whatsapp/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opens an Embedded Signup attempt.
 *
 * Returns the nonce the popup must carry back, plus the app id and
 * configuration id the Meta SDK needs in the browser. Those two are public by
 * design. The app secret is not returned, and nothing on this path reads it.
 *
 * The tenant comes from the session, never from the body: an endpoint that
 * accepted a tenant id would need a check that the caller owns it, and the
 * check that is never written is the one that is never needed.
 */
export async function POST(request: Request): Promise<Response> {
  const slug = new URL(request.url).searchParams.get("tenant");

  if (!slug) {
    return apiError("Name the workspace this belongs to.", 400);
  }

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
