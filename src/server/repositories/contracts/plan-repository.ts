import type { SubscriptionPlan } from "@/features/plans/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";

export interface PlanRepository {
  findById(id: string): Promise<SubscriptionPlan | null>;
  findMany(query?: ListQuery): Promise<PaginatedResult<SubscriptionPlan>>;
  countActive(): Promise<number>;
}
