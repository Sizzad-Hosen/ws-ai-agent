import { Prisma } from "@prisma/client";

import type { NormalisedPlan } from "@/features/plans/schemas";
import type { Plan, PlanListItem } from "@/features/plans/types";
import { prisma } from "@/server/db/prisma";
import type { PlanRepository } from "@/server/repositories/contracts/plan-repository";

import { mapPlan } from "./mappers";

/** Money crosses this boundary as a string so no precision is lost. */
function toDecimal(value: string | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value);
}

function toWriteData(values: NormalisedPlan) {
  return {
    name: values.name,
    description: values.description,
    monthlyPrice: toDecimal(values.monthlyPrice),
    annualPrice: toDecimal(values.annualPrice),
    currency: values.currency,
    features: values.features as unknown as Prisma.InputJsonValue,
    isActive: values.isActive,
  };
}

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

  async create(code: string, values: NormalisedPlan): Promise<Plan> {
    // New plans land at the end of the catalogue; screen 05 orders by this.
    const last = await prisma.plan.findFirst({
      orderBy: { sortOrder: Prisma.SortOrder.desc },
      select: { sortOrder: true },
    });

    const plan = await prisma.plan.create({
      data: {
        ...toWriteData(values),
        code,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });

    return mapPlan(plan);
  }

  async update(id: string, values: NormalisedPlan): Promise<Plan> {
    // `code` and `sortOrder` are intentionally absent: renaming a plan must not
    // change its public identifier or move it in the catalogue.
    const plan = await prisma.plan.update({
      where: { id },
      data: toWriteData(values),
    });

    return mapPlan(plan);
  }

  async delete(id: string): Promise<void> {
    await prisma.plan.delete({ where: { id } });
  }
}
