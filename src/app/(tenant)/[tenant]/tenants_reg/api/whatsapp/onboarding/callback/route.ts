import { z } from "zod";

import { apiData, apiError, apiFailure, readJsonBody } from "@/server/api/http";
import { authorizeTenantRequest } from "@/server/tenancy/tenant-guard";
import { completeOnboarding } from "@/server/whatsapp/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Finishes an Embedded Signup attempt.
 *
 * Under the workspace path so the path-scoped tenant session cookie reaches it;
 * see the start route for why.
 *
 * Everything in this body comes from the browser and none of it is trusted.
 * The nonce decides which attempt this is, and the `waba_id` is checked against
 * what Meta says the token actually grants before a single row is written. The
 * ordering lives in `completeOnboarding`, and it is the security design.
 */
const bodySchema = z
  .object({
    stateNonce: z.string().min(1, "The connection attempt is missing."),
    code: z.string().min(1, "Meta returned no authorisation code."),
    wabaId: z.string().min(1, "Meta returned no business account."),
    phoneNumberId: z.string().min(1, "Meta returned no phone number."),
    /**
     * The two-step PIN. Six digits, which is what Meta accepts; checked here so
     * an obviously wrong value never becomes a Graph round trip.
     */
    pin: z.string().regex(/^\d{6}$/, "The PIN must be six digits."),
  })
  .strict();

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly tenant: string }> },
): Promise<Response> {
  const { tenant: slug } = await context.params;

  const auth = await authorizeTenantRequest(slug);

  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);

  if (!body.ok) return body.response;

  const parsed = bodySchema.safeParse(body.value);

  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "That request was not understood.",
      400,
    );
  }

  try {
    const result = await completeOnboarding({
      tenantId: auth.context.tenant.id,
      stateNonce: parsed.data.stateNonce,
      code: parsed.data.code,
      claimedWabaId: parsed.data.wabaId,
      claimedPhoneNumberId: parsed.data.phoneNumberId,
      pin: parsed.data.pin,
    });

    if (!result.ok) {
      // 200 with a failure body rather than an HTTP error: the screen maps the
      // code to a sentence, and a 4xx would tell the browser less, not more.
      return apiData({
        connected: false,
        sessionId: result.sessionId,
        errorCode: result.error.code,
      });
    }

    return apiData({
      connected: true,
      sessionId: result.sessionId,
      accountId: result.accountId,
    });
  } catch (error: unknown) {
    return apiFailure("Unable to finish the WhatsApp connection.", error);
  }
}
