import type {
  Tenant,
  TenantDetail,
  TenantListFilters,
  TenantListItem,
} from "@/features/tenants/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";
import type { ProvisioningStatus, TenantApprovalStatus } from "@/types/status";

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

/** What a tenant's public site may show. Anonymous visitors read this. */
export interface TenantSite {
  readonly tenantId: string;
  readonly businessName: string;
  readonly slug: string;
  readonly industry: string | null;
  readonly region: string | null;
  readonly ownerName: string;
  /** `tenants.owner_phone` — the number the AI agent answers on. */
  readonly whatsappNumber: string;
  readonly planName: string | null;
  readonly approvalStatus: TenantApprovalStatus;
  /** Null when the tenant has no database record at all. */
  readonly databaseStatus: ProvisioningStatus | null;
  readonly since: string;
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
  /**
   * A tenant's public storefront, addressed by its slug.
   *
   * Separate from {@link findRoutingTargetBySubdomain}, which exists to open a
   * database connection and therefore carries secret references. This one is
   * read by an anonymous visitor, so it selects only what a storefront may
   * show: no owner email, no connection metadata, no references of any kind.
   */
  findSiteBySubdomain(subdomain: string): Promise<TenantSite | null>;
  findDetailById(id: string): Promise<TenantDetail | null>;
  findMany(query?: TenantListQuery): Promise<PaginatedResult<TenantListItem>>;
  count(): Promise<number>;
  countActive(): Promise<number>;
  updateApprovalStatus(id: string, status: TenantApprovalStatus): Promise<void>;
}
