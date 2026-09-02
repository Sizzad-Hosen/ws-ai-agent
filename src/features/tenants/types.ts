import type { ProvisioningStatus, TenantStatus } from "@/types/status";

export interface TenantOwner {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface TenantDatabaseRegistryEntry {
  readonly tenantId: string;
  readonly databaseKey: string;
  readonly region: string;
  readonly provisioningStatus: ProvisioningStatus;
  readonly provisionedAt: string | null;
}

export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: TenantStatus;
  readonly owner: TenantOwner | null;
  readonly database: TenantDatabaseRegistryEntry | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
