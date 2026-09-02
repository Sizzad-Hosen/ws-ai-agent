import { MembershipRole, MembershipStatus, Prisma } from "@prisma/client";

import type { Tenant } from "@/features/tenants/types";
import { prisma } from "@/server/db/prisma";
import type { TenantRepository } from "@/server/repositories/contracts/tenant-repository";
import type { ListQuery, PaginatedResult } from "@/types/repository";

import { provisioningStatusMap, tenantStatusMap } from "./mappers";

const tenantWithMasterRelations = Prisma.validator<Prisma.TenantDefaultArgs>()({
  include: {
    databaseRegistry: true,
    memberships: {
      where: { role: MembershipRole.OWNER, status: MembershipStatus.ACTIVE },
      include: { user: true },
      take: 1,
    },
  },
});

type TenantWithMasterRelations = Prisma.TenantGetPayload<
  typeof tenantWithMasterRelations
>;

function mapTenant(tenant: TenantWithMasterRelations): Tenant {
  const owner = tenant.memberships[0]?.user;
  const database = tenant.databaseRegistry;

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenantStatusMap[tenant.status],
    owner: owner
      ? { id: owner.id, name: owner.name, email: owner.email }
      : null,
    database: database
      ? {
          tenantId: database.tenantId,
          databaseKey: database.databaseKey,
          region: database.region,
          provisioningStatus:
            provisioningStatusMap[database.provisioningStatus],
          provisionedAt: database.provisionedAt?.toISOString() ?? null,
        }
      : null,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  };
}

export class PrismaTenantRepository implements TenantRepository {
  async findById(id: string): Promise<Tenant | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      ...tenantWithMasterRelations,
    });
    return tenant ? mapTenant(tenant) : null;
  }

  async findMany(query: ListQuery = {}): Promise<PaginatedResult<Tenant>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { slug: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : undefined;
    const [items, total] = await prisma.$transaction([
      prisma.tenant.findMany({
        where,
        skip: offset,
        take: limit,
        ...tenantWithMasterRelations,
      }),
      prisma.tenant.count({ where }),
    ]);
    return { items: items.map(mapTenant), total, limit, offset };
  }

  async count(): Promise<number> {
    return prisma.tenant.count();
  }
}
