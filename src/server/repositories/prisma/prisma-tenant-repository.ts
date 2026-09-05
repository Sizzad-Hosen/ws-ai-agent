import { Prisma, TenantApprovalStatus } from "@prisma/client";

import type {
  Tenant,
  TenantDetail,
  TenantListItem,
} from "@/features/tenants/types";
import { prisma } from "@/server/db/prisma";
import type {
  TenantListQuery,
  TenantRepository,
} from "@/server/repositories/contracts/tenant-repository";
import type { PaginatedResult } from "@/types/repository";
import type { TenantApprovalStatus as DomainTenantApprovalStatus } from "@/types/status";

import {
  mapPlan,
  mapTenant,
  mapTenantDatabase,
  tenantApprovalToPrisma,
} from "./mappers";

/** The subscription that determines the plan and MRR shown for a tenant. */
const CURRENT_SUBSCRIPTION = {
  where: { cancelledAt: null },
  orderBy: { startedAt: Prisma.SortOrder.desc },
  take: 1,
  include: { plan: true },
} as const;

export class PrismaTenantRepository implements TenantRepository {
  async findById(id: string): Promise<Tenant | null> {
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    return tenant ? mapTenant(tenant) : null;
  }

  async findDetailById(id: string): Promise<TenantDetail | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        database: true,
        subscriptions: CURRENT_SUBSCRIPTION,
      },
    });

    if (!tenant) {
      return null;
    }

    const subscription = tenant.subscriptions[0];

    return {
      tenant: mapTenant(tenant),
      planName: subscription ? mapPlan(subscription.plan).name : null,
      subscribedAt: subscription?.startedAt.toISOString() ?? null,
      infrastructure: {
        // Screens 04 and 11 need WhatsApp connection and AI telemetry, which
        // have no tables in the ERD (§2.2 / D-10). Reported as unavailable
        // rather than fabricated.
        whatsapp: null,
        ai: null,
        database: tenant.database ? mapTenantDatabase(tenant.database) : null,
        checkedAt: new Date().toISOString(),
      },
    };
  }

  async findMany(
    query: TenantListQuery = {},
  ): Promise<PaginatedResult<TenantListItem>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: Prisma.TenantWhereInput = {
      ...(query.status
        ? { approvalStatus: tenantApprovalToPrisma[query.status] }
        : {}),
      ...(query.planCode
        ? {
            subscriptions: {
              some: { cancelledAt: null, plan: { code: query.planCode } },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                businessName: {
                  contains: query.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                tenantCode: {
                  contains: query.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                ownerEmail: {
                  contains: query.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                ownerName: {
                  contains: query.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    // Sequential rather than $transaction([...]): the batch form pins one
    // pooled connection and races with other in-flight queries under the pg
    // driver adapter. A read-only list does not need snapshot isolation.
    const tenants = await prisma.tenant.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: Prisma.SortOrder.desc },
      include: { subscriptions: CURRENT_SUBSCRIPTION },
    });
    const total = await prisma.tenant.count({ where });

    const items: TenantListItem[] = tenants.map((tenant) => {
      const subscription = tenant.subscriptions[0];

      return {
        tenant: mapTenant(tenant),
        planName: subscription ? subscription.plan.name : null,
        metrics: {
          // WhatsApp connection state comes from a registry that does not
          // exist yet (§2.2). Null renders as "—" rather than a default, so
          // "no data" never reads as "not connected".
          whatsappStatus: null,
        },
      };
    });

    return { items, total, limit, offset };
  }

  async count(): Promise<number> {
    return prisma.tenant.count();
  }

  async countActive(): Promise<number> {
    return prisma.tenant.count({
      where: { approvalStatus: TenantApprovalStatus.ACTIVE },
    });
  }

  async updateApprovalStatus(
    id: string,
    status: DomainTenantApprovalStatus,
  ): Promise<void> {
    await prisma.tenant.update({
      where: { id },
      data: { approvalStatus: tenantApprovalToPrisma[status] },
    });
  }
}
