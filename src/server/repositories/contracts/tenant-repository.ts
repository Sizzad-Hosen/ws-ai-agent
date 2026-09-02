import type { Tenant } from "@/features/tenants/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";

export interface TenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findMany(query?: ListQuery): Promise<PaginatedResult<Tenant>>;
  count(): Promise<number>;
}
