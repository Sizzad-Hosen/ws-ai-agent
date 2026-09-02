import type { SubscriptionPlan } from "@/features/plans/types";
import { mockPlans } from "@/server/data/mock/master-data";
import type { PlanRepository } from "@/server/repositories/contracts/plan-repository";
import type { ListQuery, PaginatedResult } from "@/types/repository";

import { paginate } from "./pagination";

export class MockPlanRepository implements PlanRepository {
  async findById(id: string): Promise<SubscriptionPlan | null> {
    return mockPlans.find((plan) => plan.id === id) ?? null;
  }

  async findMany(
    query: ListQuery = {},
  ): Promise<PaginatedResult<SubscriptionPlan>> {
    const search = query.search?.toLocaleLowerCase();
    const matches = search
      ? mockPlans.filter((plan) =>
          `${plan.name} ${plan.code}`.toLocaleLowerCase().includes(search),
        )
      : mockPlans;

    return paginate(matches, query);
  }

  async countActive(): Promise<number> {
    return mockPlans.filter((plan) => plan.status === "active").length;
  }
}
