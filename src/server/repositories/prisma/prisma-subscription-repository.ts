import { Prisma, SubscriptionStatus } from "@prisma/client";

import type { Invoice, Subscription } from "@/features/subscriptions/types";
import { prisma } from "@/server/db/prisma";
import type { SubscriptionRepository } from "@/server/repositories/contracts/subscription-repository";
import type { ListQuery, PaginatedResult } from "@/types/repository";

import { mapInvoice, mapSubscription } from "./mappers";

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  async findById(id: string): Promise<Subscription | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });
    return subscription ? mapSubscription(subscription) : null;
  }

  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId, cancelledAt: null },
      orderBy: { startedAt: Prisma.SortOrder.desc },
    });
    return subscription ? mapSubscription(subscription) : null;
  }

  async findMany(
    query: ListQuery = {},
  ): Promise<PaginatedResult<Subscription>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const items = await prisma.subscription.findMany({
      skip: offset,
      take: limit,
      orderBy: { startedAt: Prisma.SortOrder.desc },
    });
    const total = await prisma.subscription.count();

    return { items: items.map(mapSubscription), total, limit, offset };
  }

  async findAll(): Promise<readonly Subscription[]> {
    const subscriptions = await prisma.subscription.findMany({
      orderBy: { startedAt: Prisma.SortOrder.desc },
    });
    return subscriptions.map(mapSubscription);
  }

  async findInvoicesByTenantId(tenantId: string): Promise<readonly Invoice[]> {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { invoiceNumber: Prisma.SortOrder.desc },
    });
    return invoices.map(mapInvoice);
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
