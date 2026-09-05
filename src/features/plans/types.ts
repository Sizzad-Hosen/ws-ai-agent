/**
 * `plans` in the master ERD.
 *
 * Money is carried as a decimal string so no precision is lost between the
 * database and the view. `null` prices render as "Custom" (screen 05,
 * Enterprise tier).
 */
export interface Plan {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly monthlyPrice: string | null;
  readonly annualPrice: string | null;
  readonly currency: string;
  readonly features: PlanFeatures;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly createdAt: string;
  /** Not in the ERD; needed for optimistic concurrency (2.9a). */
  readonly updatedAt: string | null;
}

export interface PlanToggle {
  readonly key: string;
  readonly label: string;
  readonly enabled: boolean;
}

/**
 * The shape stored in `plans.features` (jsonb). The ERD gives the column no
 * structure, so this versioned schema is the contract instead — see 2.8 / D-05
 * in docs/IMPLEMENTATION_PLAN.md.
 *
 * Numeric resource limits (AI messages, WhatsApp numbers, team members,
 * storage) were removed from the plan model at the product owner's request;
 * plans now describe capability and price only. The mockups for screens 05–07
 * still show those rows and are out of date on this point.
 */
export interface PlanFeatures {
  readonly version: 1;
  readonly toggles: readonly PlanToggle[];
  /** Free-text lines from the "Features Included" field on screens 06 and 07. */
  readonly highlights: readonly string[];
  /** Accent swatch on screen 06 — no ERD column exists yet (D-20). */
  readonly accentColor?: string;
  /** "POPULAR" badge on screen 05 — no ERD column exists yet (D-20). */
  readonly popular?: boolean;
}

export const EMPTY_PLAN_FEATURES: PlanFeatures = {
  version: 1,
  toggles: [],
  highlights: [],
};

/** Plan card on screen 05, with the guard rail for deactivation (D-19). */
export interface PlanListItem {
  readonly plan: Plan;
  readonly activeSubscriptions: number;
}
