import type {
  Tenant,
  TenantDetail,
  TenantListFilters,
  TenantListItem,
} from "@/features/tenants/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";
import type { TenantApprovalStatus } from "@/types/status";

export interface TenantListQuery extends ListQuery, TenantListFilters {}

export interface TenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findDetailById(id: string): Promise<TenantDetail | null>;
  findMany(query?: TenantListQuery): Promise<PaginatedResult<TenantListItem>>;
  count(): Promise<number>;
  countActive(): Promise<number>;
  updateApprovalStatus(
    id: string,
    status: TenantApprovalStatus,
  ): Promise<void>;
}
