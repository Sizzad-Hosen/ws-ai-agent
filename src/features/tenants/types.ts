import type {
  ProvisioningStatus,
  TenantApprovalStatus,
  WebhookStatus,
  WhatsappConnectionStatus,
} from "@/types/status";

/** `tenants` in the master ERD. */
export interface Tenant {
  readonly id: string;
  readonly tenantCode: string;
  readonly businessName: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly ownerPhone: string;
  readonly industry: string | null;
  readonly region: string | null;
  readonly approvalStatus: TenantApprovalStatus;
  readonly createdAt: string;
  /** `tenants.registration_id` — proposed in 2.5 / D-02, shown on screen 04. */
  readonly registrationCode: string | null;
}

/** `tenant_databases`. Credential references never leave the server. */
export interface TenantDatabase {
  readonly id: string;
  readonly tenantId: string;
  readonly databaseName: string;
  readonly region: string;
  readonly status: ProvisioningStatus;
  readonly schemaVersion: string;
  /** Display identifier for the host, never the connection string itself. */
  readonly instanceLabel: string;
  readonly lastBackupAt: string | null;
  readonly failureReason: string | null;
}

/**
 * Infrastructure Status panel on screen 04. Every field here originates outside
 * the master schema (2.2), so each sub-panel is nullable and degrades on its
 * own rather than failing the page.
 */
export interface TenantInfrastructure {
  readonly whatsapp: {
    readonly phoneNumber: string;
    readonly connectionStatus: WhatsappConnectionStatus;
    readonly webhookStatus: WebhookStatus;
  } | null;
  readonly ai: {
    readonly online: boolean;
    readonly resolutionRatePercent: number;
  } | null;
  readonly database: TenantDatabase | null;
  /** When the health snapshot was taken, so staleness is always visible. */
  readonly checkedAt: string | null;
}

/**
 * Per-tenant status shown on screen 02.
 *
 * The Messages, Orders and MRR columns were removed from this screen at the
 * product owner's request; the mockup for screen 02 is out of date on that
 * point. What remains is operational status, which still has no source (§2.2)
 * and therefore stays nullable.
 */
export interface TenantMetrics {
  readonly aiOnline: boolean | null;
  readonly whatsappStatus: WhatsappConnectionStatus | null;
}

/** One row of the tenants table (screen 02). */
export interface TenantListItem {
  readonly tenant: Tenant;
  readonly planName: string | null;
  readonly metrics: TenantMetrics;
}

/** Screen 04 aggregate. */
export interface TenantDetail {
  readonly tenant: Tenant;
  readonly planName: string | null;
  readonly subscribedAt: string | null;
  readonly infrastructure: TenantInfrastructure;
}

export interface TenantListFilters {
  readonly search?: string;
  readonly status?: TenantApprovalStatus;
  readonly planCode?: string;
  readonly whatsapp?: WhatsappConnectionStatus;
}
