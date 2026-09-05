import "server-only";

import {
  derivePlanCode,
  toPlanValues,
  type PlanFormValues,
} from "@/features/plans/schemas";
import type { Plan, PlanListItem } from "@/features/plans/types";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/audit-log";
import type { BoSessionAdmin } from "@/server/auth/types";
import { repositories } from "@/server/repositories";

/** Matches the first swatch offered by the plan form. */
const DEFAULT_ACCENT_COLOR = "#e2e8f0";

const GENERIC_WRITE_FAILURE =
  "That change could not be saved. Please try again.";

export type PlanSaveOutcome = "saved" | "not-found" | "conflict" | "failed";

export interface PlanSaveResult {
  readonly outcome: PlanSaveOutcome;
  readonly message: string;
  readonly plan: Plan | null;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

export type PlanDeleteOutcome = "deleted" | "not-found" | "in-use" | "failed";

export interface PlanDeleteResult {
  readonly outcome: PlanDeleteOutcome;
  readonly message: string;
}

/** Renders a stored plan back into the shape `planFormSchema` validates. */
export function toPlanFormValues(plan: Plan): PlanFormValues {
  return {
    name: plan.name,
    description: plan.description ?? "",
    monthlyPrice: plan.monthlyPrice ?? "",
    annualPrice: plan.annualPrice ?? "",
    currency: plan.currency,
    highlights: plan.features.highlights.join("\n"),
    accentColor: plan.features.accentColor ?? DEFAULT_ACCENT_COLOR,
    isActive: plan.isActive,
  };
}

function subscriberCount(count: number): string {
  return `${count} active subscriber${count === 1 ? "" : "s"}`;
}

/** Money is recorded as the stored string so the trail never rounds a price. */
async function auditPlanWrite(
  actor: BoSessionAdmin,
  action: typeof AUDIT_ACTIONS.PLAN_CREATE | typeof AUDIT_ACTIONS.PLAN_UPDATE,
  planId: string,
  values: PlanFormValues,
): Promise<void> {
  await recordAudit({
    actor,
    action,
    entityType: "plan",
    entityId: planId,
    metadata: {
      name: values.name,
      monthlyPrice: values.monthlyPrice,
      annualPrice: values.annualPrice,
      currency: values.currency,
      isActive: values.isActive,
    },
  });
}

/**
 * Creates or updates a plan.
 *
 * Callers own authorisation, input validation and cache revalidation; the
 * catalogue rules — code immutability, name uniqueness and the deactivation
 * guard — live here so every write path applies them identically.
 *
 * The audit entry is written here, not in the callers: the server action and
 * the REST route both come through this function, so recording it at the entry
 * points would let a new entry point silently skip it.
 *
 */
export async function savePlan(
  planId: string | null,
  values: PlanFormValues,
  actor: BoSessionAdmin,
): Promise<PlanSaveResult> {
  let existing: readonly PlanListItem[];

  try {
    existing = await repositories.plans.findAll();
  } catch (error: unknown) {
    console.error("Unable to load the plan catalogue.", error);
    return { outcome: "failed", message: GENERIC_WRITE_FAILURE, plan: null };
  }

  const current = existing.find((item) => item.plan.id === planId);

  if (planId !== null && !current) {
    return {
      outcome: "not-found",
      message: "That plan no longer exists.",
      plan: null,
    };
  }

  // Feature toggles are not on this form, so the stored set is carried through
  // rather than being silently cleared on every save.
  const normalised = toPlanValues(values, current?.plan.features.toggles ?? []);

  // Deactivating a plan that still has subscribers would silently strip their
  // entitlements, so it is blocked here rather than in the UI alone (D-19).
  if (current && !values.isActive && current.activeSubscriptions > 0) {
    return {
      outcome: "conflict",
      message: `This plan still has ${subscriberCount(current.activeSubscriptions)}. Move them to another plan before hiding it.`,
      plan: null,
    };
  }

  try {
    if (planId === null) {
      // `code` is immutable after creation, so uniqueness only matters here.
      const code = derivePlanCode(values.name);

      if (existing.some((item) => item.plan.code === code)) {
        return {
          outcome: "conflict",
          message: "A plan with this name already exists.",
          plan: null,
          fieldErrors: { name: ["Choose a name that is not already in use."] },
        };
      }

      const created = await repositories.plans.create(code, normalised);
      await auditPlanWrite(
        actor,
        AUDIT_ACTIONS.PLAN_CREATE,
        created.id,
        values,
      );

      return { outcome: "saved", message: "Plan created.", plan: created };
    }

    const updated = await repositories.plans.update(planId, normalised);
    await auditPlanWrite(actor, AUDIT_ACTIONS.PLAN_UPDATE, updated.id, values);

    return { outcome: "saved", message: "Plan updated.", plan: updated };
  } catch (error: unknown) {
    console.error("Unable to save the plan.", error);
    return { outcome: "failed", message: GENERIC_WRITE_FAILURE, plan: null };
  }
}

/**
 * Deletes a plan outright.
 *
 * `subscriptions.plan_id` and `tenant_registrations.requested_plan_id` are both
 * ON DELETE RESTRICT, so a plan anything still points at cannot be removed. The
 * check below turns that constraint into an explanation instead of a raw
 * foreign-key error, and deactivating remains the way to retire a plan that has
 * history.
 */
export async function deletePlan(
  planId: string,
  actor: BoSessionAdmin,
): Promise<PlanDeleteResult> {
  let plans: readonly PlanListItem[];

  try {
    plans = await repositories.plans.findAll();
  } catch (error: unknown) {
    console.error("Unable to load the plan catalogue.", error);
    return { outcome: "failed", message: GENERIC_WRITE_FAILURE };
  }

  const current = plans.find((item) => item.plan.id === planId);

  if (!current) {
    return { outcome: "not-found", message: "That plan no longer exists." };
  }

  if (current.activeSubscriptions > 0) {
    return {
      outcome: "in-use",
      message: `${current.plan.name} still has ${subscriberCount(current.activeSubscriptions)}. Move them to another plan, or deactivate this one instead.`,
    };
  }

  try {
    await repositories.plans.delete(planId);
  } catch (error: unknown) {
    // Cancelled subscriptions and past registrations still reference the row.
    console.error("Unable to delete the plan.", error);
    return {
      outcome: "in-use",
      message: `${current.plan.name} is still referenced by past subscriptions or registrations, so it cannot be deleted. Deactivate it instead to hide it from customers.`,
    };
  }

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.PLAN_DELETE,
    entityType: "plan",
    entityId: planId,
    metadata: { name: current.plan.name, code: current.plan.code },
  });

  return { outcome: "deleted", message: `${current.plan.name} deleted.` };
}
