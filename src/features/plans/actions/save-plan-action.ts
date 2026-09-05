"use server";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import {
  derivePlanCode,
  planFormSchema,
  toPlanValues,
} from "@/features/plans/schemas";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";

export interface PlanActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Validates a plan submission and enforces the catalogue's business rules.
 *
 * Persistence is deliberately not wired: `plans` in its ERD shape does not
 * exist in the database yet, and the schema reconciliation (M0) is awaiting
 * approval — see docs/IMPLEMENTATION_PLAN.md §2.1. Everything up to the write
 * runs for real, so wiring the repository call is the only remaining step.
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

  const values = parsed.data;
  const existing = await repositories.plans.findAll();
  const current = existing.find((item) => item.plan.id === planId);

  // Normalised here so the write path is exercised end to end.
  void toPlanValues(values, current?.plan.features.toggles ?? []);

  // `code` is immutable after creation, so uniqueness is only checked on create.
  if (planId === null) {
    const code = derivePlanCode(values.name);
    const clash = existing.find((item) => item.plan.code === code);

    if (clash) {
      return {
        success: false,
        message: "A plan with this name already exists.",
        fieldErrors: { name: ["Choose a name that is not already in use."] },
      };
    }
  }

  // Deactivating a plan that still has subscribers would silently strip their
  // entitlements, so it is blocked here rather than in the UI alone (D-19).
  if (planId !== null && !values.isActive) {
    if (current && current.activeSubscriptions > 0) {
      return {
        success: false,
        message: `This plan still has ${current.activeSubscriptions} active subscriber${
          current.activeSubscriptions === 1 ? "" : "s"
        }. Move them to another plan before hiding it.`,
      };
    }
  }

  return {
    success: false,
    message:
      "Validation passed. Saving is blocked until the master-schema migration (M0) is approved — see docs/IMPLEMENTATION_PLAN.md §2.1.",
  };
}
