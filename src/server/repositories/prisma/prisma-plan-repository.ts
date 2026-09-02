import { PlanStatus } from "@prisma/client";

import type { SubscriptionPlan } from "@/features/plans/types";
import { prisma } from "@/server/db/prisma";
import type { PlanRepository } from "@/server/repositories/contracts/plan-repository";
import type { ListQuery, PaginatedResult } from "@/types/repository";

import { mapPlan } from "./mappers";

export class PrismaPlanRepository implements PlanRepository {
  async findById(id: string): Promise<SubscriptionPlan | null> {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    return plan ? mapPlan(plan) : null;
  }

  async findMany(
    query: ListQuery = {},
  ): Promise<PaginatedResult<SubscriptionPlan>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { code: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : undefined;
    const [items, total] = await prisma.$transaction([
      prisma.subscriptionPlan.findMany({ where, skip: offset, take: limit }),
      prisma.subscriptionPlan.count({ where }),
    ]);
    return { items: items.map(mapPlan), total, limit, offset };
  }

  async countActive(): Promise<number> {
    return prisma.subscriptionPlan.count({
      where: { status: PlanStatus.ACTIVE },
    });
  }
}
