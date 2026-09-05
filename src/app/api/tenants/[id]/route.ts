import { z } from "zod";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { authorizeApiRequest } from "@/server/api/authorization";
import { apiData, apiError, apiFailure } from "@/server/api/http";
import { repositories } from "@/server/repositories";

interface TenantRouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

const paramsSchema = z.object({ id: z.uuid() });

export async function GET(
  _request: Request,
  context: TenantRouteContext,
): Promise<Response> {
  const auth = await authorizeApiRequest(PLATFORM_PERMISSIONS.TENANTS_READ);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = paramsSchema.safeParse(await context.params);

  if (!parsed.success) {
    return apiError("That is not a valid tenant identifier.", 400);
  }

  try {
    const tenant = await repositories.tenants.findDetailById(parsed.data.id);

    if (!tenant) {
      return apiError("That tenant does not exist.", 404);
    }

    return apiData(tenant);
  } catch (error: unknown) {
    return apiFailure("Unable to load the tenant.", error);
  }
}
