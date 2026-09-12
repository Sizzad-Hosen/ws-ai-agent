import { z } from "zod";

import { apiData, apiError, apiFailure } from "@/server/api/http";
import { authorizeTenantRequest } from "@/server/tenancy/tenant-guard";
import { readOnboardingStatus } from "@/server/whatsapp/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.uuid() });

/**
 * What the connect screen polls while the flow runs.
 *
 * Under the workspace path so the path-scoped session cookie reaches it; see
 * the start route for why.
 *
 * Scoped to the signed-in tenant, so an attempt belonging to another workspace
 * reads as not found rather than as forbidden — a 403 would confirm the id
 * exists. Carries the error *code* and not Meta's wording, because the screen
 * owns the sentence and the same failure should read the same way everywhere.
 */
export async function GET(
  _request: Request,
  context: {
    readonly params: Promise<{ readonly tenant: string; readonly id: string }>;
  },
): Promise<Response> {
  const { tenant: slug, id } = await context.params;

  const auth = await authorizeTenantRequest(slug);

  if (!auth.ok) return auth.response;

  const params = paramsSchema.safeParse({ id });

  if (!params.success) {
    return apiError("That is not a valid connection attempt.", 400);
  }

  try {
    const status = await readOnboardingStatus(
      auth.context.tenant.id,
      params.data.id,
    );

    if (!status) {
      return apiError("No such connection attempt.", 404);
    }

    return apiData(status);
  } catch (error: unknown) {
    return apiFailure("Unable to read the connection status.", error);
  }
}
