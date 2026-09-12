import { Prisma, TenantApprovalStatus, TenantStatus } from "@prisma/client";

import type {
  Tenant,
  TenantDetail,
  TenantListItem,
} from "@/features/tenants/types";
import { prisma } from "@/server/db/prisma";
import type {
  TenantListQuery,
  TenantRepository,
  TenantRoutingTarget,
  TenantSite,
  TenantStatusChange,
} from "@/server/repositories/contracts/tenant-repository";
import type { PaginatedResult } from "@/types/repository";
import type { TenantDisplayStatus } from "@/types/status";

import {
  mapPlan,
  mapTenant,
  mapTenantDatabase,
  provisioningMap,
  tenantApprovalMap,
  tenantApprovalToPrisma,
  tenantStatusMap,
  tenantStatusToPrisma,
} from "./mappers";

/**
 * The stored columns behind each display status.
 *
 * The inverse of `tenantDisplayStatus`, and it has to stay that way: filtering
 * on "approved" must return exactly the rows the list badges as approved. The
 * unit test in `display-status.test.ts` holds the two together.
 */
function displayStatusWhere(
  status: TenantDisplayStatus | undefined,
): Prisma.TenantWhereInput {
  switch (status) {
    case undefined:
      return {};
    case "pending":
      return { approvalStatus: TenantApprovalStatus.PENDING_REVIEW };
    case "rejected":
      return { approvalStatus: TenantApprovalStatus.REJECTED };
    case "suspended":
      return {
        approvalStatus: TenantApprovalStatus.APPROVED,
        status: TenantStatus.SUSPENDED,
      };
    case "approved":
      // Every approved workspace that is not suspended, whatever else it is
      // doing — provisioning, trialing, running, archived.
      return {
        approvalStatus: TenantApprovalStatus.APPROVED,
        status: { not: TenantStatus.SUSPENDED },
      };
  }
}

/** The subscription that determines the plan and MRR shown for a tenant. */
const CURRENT_SUBSCRIPTION = {
  where: { cancelledAt: null },
  orderBy: { startedAt: Prisma.SortOrder.desc },
  take: 1,
  include: { plan: true },
} as const;

export class PrismaTenantRepository implements TenantRepository {
  async findRoutingTargetBySubdomain(
    subdomain: string,
  ): Promise<TenantRoutingTarget | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: subdomain },
      select: {
        id: true,
        businessName: true,
        approvalStatus: true,
        status: true,
        database: {
          select: {
            databaseName: true,
            hostReference: true,
            port: true,
            usernameReference: true,
            secretReference: true,
            status: true,
          },
        },
      },
    });

    if (!tenant?.database) return null;

    return {
      tenantId: tenant.id,
      businessName: tenant.businessName,
      approvalStatus: tenantApprovalMap[tenant.approvalStatus],
      status: tenantStatusMap[tenant.status],
      databaseName: tenant.database.databaseName,
      host: tenant.database.hostReference,
      port: tenant.database.port,
      username: tenant.database.usernameReference,
      secretReference: tenant.database.secretReference,
      provisioned: tenant.database.status === "READY",
    };
  }

  async findById(id: string): Promise<Tenant | null> {
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    return tenant ? mapTenant(tenant) : null;
  }

  async findSiteBySubdomain(subdomain: string): Promise<TenantSite | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: subdomain },
      // An explicit select, not an include: this row is rendered for anonymous
      // visitors, so the columns it may not carry are excluded here rather than
      // filtered later.
      select: {
        id: true,
        businessName: true,
        slug: true,
        ownerName: true,
        ownerPhone: true,
        industry: true,
        businessRegion: true,
        approvalStatus: true,
        status: true,
        createdAt: true,
        database: { select: { status: true } },
        subscriptions: {
          where: { cancelledAt: null },
          orderBy: { startedAt: Prisma.SortOrder.desc },
          take: 1,
          select: { plan: { select: { name: true } } },
        },
      },
    });

    if (!tenant) return null;

    return {
      tenantId: tenant.id,
      businessName: tenant.businessName,
      slug: tenant.slug,
      industry: tenant.industry,
      region: tenant.businessRegion,
      ownerName: tenant.ownerName,
      whatsappNumber: tenant.ownerPhone,
      planName: tenant.subscriptions[0]?.plan.name ?? null,
      approvalStatus: tenantApprovalMap[tenant.approvalStatus],
      status: tenantStatusMap[tenant.status],
      databaseStatus: tenant.database
        ? provisioningMap[tenant.database.status]
        : null,
      since: tenant.createdAt.toISOString(),
    };
  }

  async findDetailById(id: string): Promise<TenantDetail | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        database: true,
        subscriptions: CURRENT_SUBSCRIPTION,
        registration: { select: { registrationCode: true } },
      },
    });

    if (!tenant) {
      return null;
    }

    const subscription = tenant.subscriptions[0];

    return {
      tenant: mapTenant(tenant, tenant.registration?.registrationCode ?? null),
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
      // `tenants` is soft-deleted, and the step-4 partial index assumes every
      // list read excludes the deleted rows.
      deletedAt: null,
      ...displayStatusWhere(query.status),
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
      include: {
        subscriptions: CURRENT_SUBSCRIPTION,
        registration: { select: { registrationCode: true } },
      },
    });
    const total = await prisma.tenant.count({ where });

    const items: TenantListItem[] = tenants.map((tenant) => {
      const subscription = tenant.subscriptions[0];

      return {
        tenant: mapTenant(
          tenant,
          tenant.registration?.registrationCode ?? null,
        ),
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
    return prisma.tenant.count({ where: { deletedAt: null } });
  }

  async countActive(): Promise<number> {
    // Active is a lifecycle state, not a verdict: an approved tenant still
    // provisioning is not yet active.
    return prisma.tenant.count({
      where: { deletedAt: null, status: TenantStatus.ACTIVE },
    });
  }

  async updateStatuses(id: string, change: TenantStatusChange): Promise<void> {
    await prisma.tenant.update({
      where: { id },
      data: {
        ...(change.approvalStatus
          ? { approvalStatus: tenantApprovalToPrisma[change.approvalStatus] }
          : {}),
        ...(change.status
          ? { status: tenantStatusToPrisma[change.status] }
          : {}),
      },
    });
  }
}
