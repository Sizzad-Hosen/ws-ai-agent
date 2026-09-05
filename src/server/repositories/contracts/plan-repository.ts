import type { Plan, PlanListItem } from "@/features/plans/types";

export interface PlanRepository {
  findById(id: string): Promise<Plan | null>;
  findByCode(code: string): Promise<Plan | null>;
  /** Ordered by `sort_order`; drafts included so admins can see them. */
  findAll(): Promise<readonly PlanListItem[]>;
  countActive(): Promise<number>;
}
