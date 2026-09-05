import type { Plan, PlanListItem } from "@/features/plans/types";
import type { NormalisedPlan } from "@/features/plans/schemas";

export interface PlanRepository {
  findById(id: string): Promise<Plan | null>;
  findByCode(code: string): Promise<Plan | null>;
  /** Ordered by `sort_order`; drafts included so admins can see them. */
  findAll(): Promise<readonly PlanListItem[]>;
  countActive(): Promise<number>;
  /** `code` is derived once here and immutable thereafter (D-21). */
  create(code: string, values: NormalisedPlan): Promise<Plan>;
  update(id: string, values: NormalisedPlan): Promise<Plan>;
  delete(id: string): Promise<void>;
}
