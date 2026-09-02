import type { Tenant } from "@/features/tenants/types";
import { mockTenants } from "@/server/data/mock/master-data";
import type { TenantRepository } from "@/server/repositories/contracts/tenant-repository";
import type { ListQuery, PaginatedResult } from "@/types/repository";

import { paginate } from "./pagination";

export class MockTenantRepository implements TenantRepository {
  async findById(id: string): Promise<Tenant | null> {
    return mockTenants.find((tenant) => tenant.id === id) ?? null;
  }

  async findMany(query: ListQuery = {}): Promise<PaginatedResult<Tenant>> {
    const search = query.search?.toLocaleLowerCase();
    const matches = search
      ? mockTenants.filter((tenant) =>
          `${tenant.name} ${tenant.slug} ${tenant.owner?.email ?? ""}`
            .toLocaleLowerCase()
            .includes(search),
        )
      : mockTenants;

    return paginate(matches, query);
  }

  async count(): Promise<number> {
    return mockTenants.length;
  }
}
