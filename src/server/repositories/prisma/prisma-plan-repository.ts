import { Prisma } from "@prisma/client";

import type { Plan, PlanListItem } from "@/features/plans/types";
import { prisma } from "@/server/db/prisma";
import type { PlanRepository } from "@/server/repositories/contracts/plan-repository";

import { mapPlan } from "./mappers";

export class PrismaPlanRepository implements PlanRepository {
  async findById(id: string): Promise<Plan | null> {
    const plan = await prisma.plan.findUnique({ where: { id } });
    return plan ? mapPlan(plan) : null;
  }

  async findByCode(code: string): Promise<Plan | null> {
    const plan = await prisma.plan.findUnique({ where: { code } });
    return plan ? mapPlan(plan) : null;
  }

  async findAll(): Promise<readonly PlanListItem[]> {
    const plans = await prisma.plan.findMany({
      orderBy: { sortOrder: Prisma.SortOrder.asc },
      include: {
        _count: {
          // Anything not cancelled or expired still depends on this plan.
          select: {
            subscriptions: {
              where: { status: { notIn: ["CANCELED", "EXPIRED"] } },
            },
          },
        },
      },
    });

    return plans.map((plan) => ({
      plan: mapPlan(plan),
      activeSubscriptions: plan._count.subscriptions,
    }));
  }

  async countActive(): Promise<number> {
    return prisma.plan.count({ where: { isActive: true } });
  }
}
