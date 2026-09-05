import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import {
  deletePlan,
  savePlan,
  toPlanFormValues,
} from "@/features/plans/lifecycle";
import { planFormSchema } from "@/features/plans/schemas";
import type { Plan } from "@/features/plans/types";
import { authorizeApiRequest } from "@/server/api/authorization";
import { apiData, apiError, apiFailure, readJsonBody } from "@/server/api/http";
import { repositories } from "@/server/repositories";

interface PlanRouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

const paramsSchema = z.object({ id: z.uuid() });
const patchSchema = z.record(z.string(), z.unknown());

const PLAN_FIELDS = [
  "name",
  "description",
  "monthlyPrice",
  "annualPrice",
  "currency",
  "highlights",
  "accentColor",
  "isActive",
] as const;

/**
 * PATCH is partial, so the submitted fields are laid over the stored plan and
 * the whole object is then validated: the cross-field price rule has to see
 * both prices whichever one the caller sent.
 */
function mergePatch(
  plan: Plan,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...toPlanFormValues(plan) };

  for (const field of PLAN_FIELDS) {
    if (field in patch) {
      merged[field] = patch[field];
    }
  }

  return merged;
}

export async function GET(
  _request: Request,
  context: PlanRouteContext,
): Promise<Response> {
  const auth = await authorizeApiRequest(PLATFORM_PERMISSIONS.PLANS_READ);

  if (!auth.ok) {
    return auth.response;
  }

  const params = paramsSchema.safeParse(await context.params);

  if (!params.success) {
    return apiError("That is not a valid plan identifier.", 400);
  }

  try {
    const plan = await repositories.plans.findById(params.data.id);

    if (!plan) {
      return apiError("That plan does not exist.", 404);
    }

    return apiData(plan);
  } catch (error: unknown) {
    return apiFailure("Unable to load the plan.", error);
  }
}

export async function PATCH(
  request: Request,
  context: PlanRouteContext,
): Promise<Response> {
  const auth = await authorizeApiRequest(PLATFORM_PERMISSIONS.PLANS_MANAGE);

  if (!auth.ok) {
    return auth.response;
  }

  const params = paramsSchema.safeParse(await context.params);

  if (!params.success) {
    return apiError("That is not a valid plan identifier.", 400);
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return body.response;
  }

  const patch = patchSchema.safeParse(body.value);

  if (!patch.success) {
    return apiError("Send an object of plan fields to change.", 400);
  }

  const planId = params.data.id;
  let existing: Plan | null;

  try {
    existing = await repositories.plans.findById(planId);
  } catch (error: unknown) {
    return apiFailure("Unable to load the plan.", error);
  }

  if (!existing) {
    return apiError("That plan does not exist.", 404);
  }

  const merged = planFormSchema.safeParse(mergePatch(existing, patch.data));

  if (!merged.success) {
    return apiError("Check the submitted plan fields and try again.", 400);
  }

  const result = await savePlan(planId, merged.data, auth.admin);

  if (result.outcome === "not-found") {
    return apiError(result.message, 404);
  }

  if (result.outcome === "conflict") {
    return apiError(result.message, 409);
  }

  if (result.outcome !== "saved" || !result.plan) {
    return apiError(result.message, 500);
  }

  revalidatePath(ROUTES.bo.plans);
  revalidatePath(ROUTES.bo.planEdit(planId));

  return apiData(result.plan);
}

export async function DELETE(
  _request: Request,
  context: PlanRouteContext,
): Promise<Response> {
  const auth = await authorizeApiRequest(PLATFORM_PERMISSIONS.PLANS_MANAGE);

  if (!auth.ok) {
    return auth.response;
  }

  const params = paramsSchema.safeParse(await context.params);

  if (!params.success) {
    return apiError("That is not a valid plan identifier.", 400);
  }

  const planId = params.data.id;
  const result = await deletePlan(planId, auth.admin);

  if (result.outcome === "not-found") {
    return apiError(result.message, 404);
  }

  if (result.outcome === "in-use") {
    return apiError(result.message, 409);
  }

  if (result.outcome === "failed") {
    return apiError(result.message, 500);
  }

  revalidatePath(ROUTES.bo.plans);

  return apiData({ id: planId, message: result.message });
}
