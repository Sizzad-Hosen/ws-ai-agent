import { SubscriptionStatus } from "@prisma/client";

import type { Subscription } from "@/features/subscriptions/types";
import { prisma } from "@/server/db/prisma";
import type { SubscriptionRepository } from "@/server/repositories/contracts/subscription-repository";
import type { ListQuery, PaginatedResult } from "@/types/repository";

import { mapSubscription } from "./mappers";

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  async findById(id: string): Promise<Subscription | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });
    return subscription ? mapSubscription(subscription) : null;
  }

  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    return subscription ? mapSubscription(subscription) : null;
  }

  async findMany(
    query: ListQuery = {},
  ): Promise<PaginatedResult<Subscription>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const [items, total] = await prisma.$transaction([
      prisma.subscription.findMany({ skip: offset, take: limit }),
      prisma.subscription.count(),
    ]);
    return { items: items.map(mapSubscription), total, limit, offset };
  }

  async countActive(): Promise<number> {
    return prisma.subscription.count({
      where: {
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
    });
  }
}
