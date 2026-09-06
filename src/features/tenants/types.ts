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
  /** Public storefront URL. Null when the tenant has no site on file. */
  readonly websiteUrl: string | null;
  /**
   * Host label that addresses this tenant, e.g. "acme" in /acme. Null until
   * provisioning assigns one; without it there is no workspace to link to.
   */
  readonly subdomain: string | null;
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
 * The AI Status, Messages, Orders and MRR columns were removed from this screen
 * at the product owner's request; the mockup for screen 02 is out of date on
 * that point. WhatsApp connection state remains, and still has no source
 * (§2.2), so it stays nullable.
 */
export interface TenantMetrics {
  readonly whatsappStatus: WhatsappConnectionStatus | null;
}

/**
 * A registration awaiting review, shown on screen 02 as a pending row.
 *
 * Not a tenant, and deliberately a separate type. An application has no tenant
 * code, no plan it is actually on and no database; giving it a `Tenant` shape
 * would mean inventing those or leaving a tenant half-null everywhere it is
 * read. It becomes a tenant when it is approved, and not before.
 */
export interface PendingTenantApplication {
  readonly registrationId: string;
  readonly registrationCode: string;
  readonly businessName: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly requestedPlanName: string | null;
  readonly submittedAt: string;
  readonly checksPassed: number;
  readonly checksTotal: number;
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
