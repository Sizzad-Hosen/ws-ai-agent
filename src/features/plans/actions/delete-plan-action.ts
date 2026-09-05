"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { deletePlan } from "@/features/plans/lifecycle";
import { requirePermission } from "@/server/auth/authorization";

import type { PlanActionResult } from "./save-plan-action";

const inputSchema = z.object({ planId: z.uuid("Unknown plan.") });

/**
 * Deletes a plan outright.
 *
 * The guard rails live in `@/features/plans/lifecycle`, which the REST route
 * shares, so the two entry points cannot disagree.
 */
export async function deletePlanAction(
  input: unknown,
): Promise<PlanActionResult> {
  await requirePermission(PLATFORM_PERMISSIONS.PLANS_MANAGE);

  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "That request was not understood." };
  }

  const result = await deletePlan(parsed.data.planId);

  if (result.outcome !== "deleted") {
    return { success: false, message: result.message };
  }

  revalidatePath(ROUTES.bo.plans);

  return { success: true, message: result.message };
}
