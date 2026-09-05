import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import {
  applyTenantDecision,
  TENANT_DECISIONS,
} from "@/features/tenants/lifecycle";
import { authorizeApiRequest } from "@/server/api/authorization";
import { apiData, apiError, readJsonBody } from "@/server/api/http";

interface TenantRouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

const paramsSchema = z.object({ id: z.uuid() });
const bodySchema = z.object({ decision: z.enum(TENANT_DECISIONS) });

export async function POST(
  request: Request,
  context: TenantRouteContext,
): Promise<Response> {
  const auth = await authorizeApiRequest(PLATFORM_PERMISSIONS.TENANTS_MANAGE);

  if (!auth.ok) {
    return auth.response;
  }

  const params = paramsSchema.safeParse(await context.params);

  if (!params.success) {
    return apiError("That is not a valid tenant identifier.", 400);
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return body.response;
  }

  const parsed = bodySchema.safeParse(body.value);

  if (!parsed.success) {
    return apiError(
      `Provide a decision of ${TENANT_DECISIONS.join(", ")}.`,
      400,
    );
  }

  const tenantId = params.data.id;
  const result = await applyTenantDecision(tenantId, parsed.data.decision);

  if (result.outcome === "not-found") {
    return apiError(result.message, 404);
  }

  if (result.outcome === "illegal-transition") {
    return apiError(result.message, 409);
  }

  if (result.outcome === "failed") {
    return apiError(result.message, 500);
  }

  // The BO pages are server rendered, so a REST write must invalidate them too.
  revalidatePath(ROUTES.bo.tenants);
  revalidatePath(ROUTES.bo.tenant(tenantId));

  return apiData({
    id: tenantId,
    approvalStatus: result.approvalStatus,
    message: result.message,
  });
}
