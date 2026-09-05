"use server";

import { revalidatePath } from "next/cache";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { savePlan } from "@/features/plans/lifecycle";
import { planFormSchema } from "@/features/plans/schemas";
import { requirePermission } from "@/server/auth/authorization";

export interface PlanActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Creates or updates a plan.
 *
 * The catalogue rules live in `@/features/plans/lifecycle`, which the REST
 * route shares, so the two entry points cannot disagree.
 */
export async function savePlanAction(
  planId: string | null,
  input: unknown,
): Promise<PlanActionResult> {
  await requirePermission(PLATFORM_PERMISSIONS.PLANS_MANAGE);

  const parsed = planFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await savePlan(planId, parsed.data);

  if (result.outcome !== "saved") {
    return {
      success: false,
      message: result.message,
      fieldErrors: result.fieldErrors,
    };
  }

  revalidatePath(ROUTES.bo.plans);
  if (planId !== null) revalidatePath(ROUTES.bo.planEdit(planId));

  return { success: true, message: result.message };
}
