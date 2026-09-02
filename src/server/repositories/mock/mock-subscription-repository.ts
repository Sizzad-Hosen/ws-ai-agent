import type { Subscription } from "@/features/subscriptions/types";
import { mockSubscriptions } from "@/server/data/mock/master-data";
import type { SubscriptionRepository } from "@/server/repositories/contracts/subscription-repository";
import type { ListQuery, PaginatedResult } from "@/types/repository";

import { paginate } from "./pagination";

export class MockSubscriptionRepository implements SubscriptionRepository {
  async findById(id: string): Promise<Subscription | null> {
    return (
      mockSubscriptions.find((subscription) => subscription.id === id) ?? null
    );
  }

  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    return (
      mockSubscriptions.find(
        (subscription) => subscription.tenantId === tenantId,
      ) ?? null
    );
  }

  async findMany(
    query: ListQuery = {},
  ): Promise<PaginatedResult<Subscription>> {
    return paginate(mockSubscriptions, query);
  }

  async countActive(): Promise<number> {
    return mockSubscriptions.filter((subscription) =>
      ["active", "trialing"].includes(subscription.status),
    ).length;
  }
}
