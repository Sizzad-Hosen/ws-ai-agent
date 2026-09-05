import { revalidatePath } from "next/cache";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { savePlan } from "@/features/plans/lifecycle";
import { planFormSchema } from "@/features/plans/schemas";
import { authorizeApiRequest } from "@/server/api/authorization";
import { apiData, apiError, apiFailure, readJsonBody } from "@/server/api/http";
import { repositories } from "@/server/repositories";

export async function GET(): Promise<Response> {
  const auth = await authorizeApiRequest(PLATFORM_PERMISSIONS.PLANS_READ);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const items = await repositories.plans.findAll();
    return apiData({ items, total: items.length });
  } catch (error: unknown) {
    return apiFailure("Unable to list plans.", error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeApiRequest(PLATFORM_PERMISSIONS.PLANS_MANAGE);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return body.response;
  }

  const parsed = planFormSchema.safeParse(body.value);

  if (!parsed.success) {
    return apiError("Check the submitted plan fields and try again.", 400);
  }

  const result = await savePlan(null, parsed.data);

  if (result.outcome === "conflict") {
    return apiError(result.message, 409);
  }

  if (result.outcome !== "saved" || !result.plan) {
    return apiError(result.message, 500);
  }

  revalidatePath(ROUTES.bo.plans);

  return apiData(result.plan, 201);
}
