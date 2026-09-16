import { env } from "@/config/env";
import { listPhoneNumbers } from "@/lib/whatsapp/graph";
import { apiData, apiError, apiFailure } from "@/server/api/http";
import { authorizeTenantRequest } from "@/server/tenancy/tenant-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The numbers on a WhatsApp Business Account a tenant has shared with us.
 *
 * Step 5 of Manual setup. The tenant has granted partner access from their own
 * Meta Business Settings, and this is the read that proves it worked: if our
 * platform token can list their numbers, the grant is live.
 *
 * Under `/{tenant}/tenants_reg/` for the same reason as the onboarding routes
 * — the tenant session cookie is path-scoped to the workspace root, so a route
 * outside it never receives the cookie.
 *
 * **Every failure is the same sentence to the caller.** Meta answers a missing
 * grant with 403 and an unknown id with 404, and both mean one thing to a shop
 * owner: we cannot see your account yet, check steps 3 and 4. Meta's own
 * wording names scopes and permissions, which helps nobody on that screen. The
 * real code is logged, not returned.
 */

/** A WABA id is a long decimal string. Anything else never reaches Meta. */
const WABA_ID = /^\d{8,25}$/;

interface Body {
  readonly wabaId?: unknown;
}

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly tenant: string }> },
): Promise<Response> {
  const { tenant: slug } = await context.params;

  const auth = await authorizeTenantRequest(slug);

  if (!auth.ok) return auth.response;

  // No partner id means this deployment is not an approved partner, so there
  // is no grant a tenant could have made and nothing to look up.
  if (
    env.META_PARTNER_BUSINESS_ID === "" ||
    env.PLATFORM_WA_ACCESS_TOKEN === ""
  ) {
    return apiError(
      "Partner access is not available on this deployment yet.",
      503,
    );
  }

  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return apiError("Send a WhatsApp Business Account ID.", 400);
  }

  const wabaId = typeof body.wabaId === "string" ? body.wabaId.trim() : "";

  if (!WABA_ID.test(wabaId)) {
    return apiError(
      "That does not look like a WhatsApp Business Account ID.",
      400,
    );
  }

  try {
    const result = await listPhoneNumbers(
      {
        appId: env.META_APP_ID,
        appSecret: env.META_APP_SECRET,
        version: env.META_GRAPH_VERSION,
      },
      wabaId,
      env.PLATFORM_WA_ACCESS_TOKEN,
    );

    if (!result.ok) {
      // Logged with the tenant, never with the token. The tenant id is what
      // makes a support question answerable; Meta's code is what makes it
      // diagnosable.
      console.warn(
        JSON.stringify({
          at: "whatsapp.partner",
          event: "phone_numbers.refused",
          tenantId: auth.context.tenant.id,
          code: result.error.code,
          httpStatus: result.error.httpStatus,
        }),
      );

      // 200 with an empty list, not an error status. The client shows one
      // sentence for every not-yet-visible case, and an error status here
      // would have it show a second, unhelpful one.
      return apiData({ numbers: [] });
    }

    return apiData({
      numbers: result.data.map((number) => ({
        id: number.id,
        displayPhoneNumber: number.displayPhoneNumber ?? "",
        verifiedName: number.verifiedName ?? "",
      })),
    });
  } catch (error: unknown) {
    return apiFailure("Unable to look up your WhatsApp numbers.", error);
  }
}
