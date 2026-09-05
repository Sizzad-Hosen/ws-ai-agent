import type { PlanListItem } from "@/features/plans/types";

/** A plan as the public pricing table needs it. */
export interface PublicPlan {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly currency: string;
  /** Per-month figures. `null` means a negotiated tier, rendered "Custom". */
  readonly monthlyPrice: string | null;
  /** Annual price divided across twelve months, for the annual toggle. */
  readonly monthlyPriceAnnual: string | null;
  readonly annualTotal: string | null;
  readonly highlights: readonly string[];
  readonly popular: boolean;
}

/**
 * The saving the annual option actually delivers, as a whole percent.
 *
 * The mockup hard-codes "-20%". Deriving it from the catalogue instead means
 * the badge cannot promise a discount the plans do not give: editing a price in
 * the back office moves this number with it.
 */
export function annualSavingPercent(plans: readonly PublicPlan[]): number {
  let monthlyTotal = 0;
  let annualTotal = 0;

  for (const plan of plans) {
    if (plan.monthlyPrice === null || plan.annualTotal === null) continue;
    monthlyTotal += Number(plan.monthlyPrice) * 12;
    annualTotal += Number(plan.annualTotal);
  }

  if (monthlyTotal <= 0 || annualTotal >= monthlyTotal) return 0;

  return Math.round(((monthlyTotal - annualTotal) / monthlyTotal) * 100);
}

export function toPublicPlans(
  items: readonly PlanListItem[],
): readonly PublicPlan[] {
  return items
    .filter((item) => item.plan.isActive)
    .map(({ plan }) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      currency: plan.currency,
      monthlyPrice: plan.monthlyPrice,
      monthlyPriceAnnual:
        plan.annualPrice === null
          ? null
          : (Number(plan.annualPrice) / 12).toFixed(2),
      annualTotal: plan.annualPrice,
      highlights: plan.features.highlights,
      popular: plan.features.popular === true,
    }));
}
