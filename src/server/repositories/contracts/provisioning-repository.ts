import type { ProvisioningStatus } from "@/types/status";

export interface ProvisionInput {
  readonly registrationId: string;
  readonly planId: string;
  readonly priceSnapshot: string;
  readonly currency: string;
  /** Root domain for host-based tenant sites; empty selects path addressing. */
  readonly rootDomain: string;
  /** Platform origin, used when tenant sites are served from its own root. */
  readonly appUrl: string;
  /** Region recorded on the tenant's database row. */
  readonly region: string;
  /** The approving administrator: `tenants.approved_by` and the audit actor. */
  readonly actorId: string;
}

export interface ProvisionedTenant {
  readonly tenantId: string;
  readonly tenantCode: string;
  /** `tenants.slug`. */
  readonly subdomain: string;
  /** Derived from the slug, not stored. */
  readonly websiteUrl: string | null;
  readonly databaseName: string;
  readonly subscriptionId: string;
  /** The invited owner created alongside the tenant. */
  readonly ownerTenantUserId: string;
}

export type ProvisionOutcome =
  | { readonly ok: true; readonly tenant: ProvisionedTenant }
  | { readonly ok: false; readonly reason: ProvisionFailure };

export type ProvisionFailure =
  /** The registration vanished, or is no longer awaiting review. */
  | "not-pending"
  /** Business name yields no usable host label. */
  | "no-subdomain"
  /** An approved tenant already exists for this registration's owner. */
  | "already-provisioned"
  | "failed";

export interface ProvisioningRepository {
  /**
   * Turns an approved registration into a tenant, its database record, its
   * invited owner and its subscription, marks the registration approved and
   * writes the audit entry — all or nothing.
   *
   * A tenant without a database row, an owner or a subscription is not a
   * half-finished tenant, it is a broken one, so the whole set commits together
   * or not at all. The audit row is inside the same transaction for the same
   * reason: an approval nobody can trace is not an approval.
   */
  provisionApprovedTenant(input: ProvisionInput): Promise<ProvisionOutcome>;
  /**
   * Marks a pending registration rejected, recording why.
   *
   * Creates nothing: no tenant, no owner, no database. Returns false if the
   * registration was not awaiting review.
   */
  rejectRegistration(input: RejectInput): Promise<boolean>;
  /**
   * Records where a tenant's physical database got to.
   *
   * Separate from {@link provisionApprovedTenant} because creating a database
   * is not something a transaction can hold: `CREATE DATABASE` cannot run
   * inside one, and it happens on a different connection to a different
   * server. The master row therefore states the intent first and the outcome
   * second, and a tenant whose database never arrives is FAILED rather than
   * silently absent.
   */
  setDatabaseStatus(
    tenantId: string,
    status: ProvisioningStatus,
    schemaVersion?: string,
  ): Promise<void>;
  /** The database row for a tenant, for a retry after a failed provision. */
  findDatabaseTarget(tenantId: string): Promise<DatabaseTarget | null>;
}

export interface RejectInput {
  readonly registrationId: string;
  /** Stored in `tenant_registrations.rejection_reason`. Never blank. */
  readonly reason: string;
  readonly actorId: string;
}

export interface DatabaseTarget {
  readonly tenantId: string;
  readonly databaseName: string;
  readonly status: ProvisioningStatus;
}
