import type {
  Tenant,
  TenantDetail,
  TenantListFilters,
  TenantListItem,
} from "@/features/tenants/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";
import type { TenantApprovalStatus } from "@/types/status";

export interface TenantListQuery extends ListQuery, TenantListFilters {}

/** Everything needed to open a connection to a tenant's own database. */
export interface TenantRoutingTarget {
  readonly tenantId: string;
  readonly businessName: string;
  readonly approvalStatus: TenantApprovalStatus;
  readonly databaseName: string;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly secretReference: string;
  readonly provisioned: boolean;
}

export interface TenantRepository {
  findById(id: string): Promise<Tenant | null>;
  /**
   * Resolves a host label to the tenant it routes to, with its database
   * connection target. Null when no tenant claims the label.
   */
  findRoutingTargetBySubdomain(
    subdomain: string,
  ): Promise<TenantRoutingTarget | null>;
  findDetailById(id: string): Promise<TenantDetail | null>;
  findMany(query?: TenantListQuery): Promise<PaginatedResult<TenantListItem>>;
  count(): Promise<number>;
  countActive(): Promise<number>;
  updateApprovalStatus(id: string, status: TenantApprovalStatus): Promise<void>;
}
