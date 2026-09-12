import { z } from "zod";

import { apiData, apiError, apiFailure } from "@/server/api/http";
import { authorizeTenantRequest } from "@/server/tenancy/tenant-guard";
import { readOnboardingStatus } from "@/server/whatsapp/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.uuid() });

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * What the connect screen polls while the flow runs.
 *
 * Scoped to the signed-in tenant, so a session id belonging to another
 * workspace reads as not found rather than as forbidden — a 403 would confirm
 * the id exists.
 *
 * Carries the error **code** and not Meta's wording: the screen owns the
 * sentence, so the same failure reads the same way wherever it surfaces.
 */
export async function GET(
  request: Request,
  context: Context,
): Promise<Response> {
  const slug = new URL(request.url).searchParams.get("tenant");

  if (!slug) {
    return apiError("Name the workspace this belongs to.", 400);
  }

  const auth = await authorizeTenantRequest(slug);

  if (!auth.ok) return auth.response;

  const params = paramsSchema.safeParse(await context.params);

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
