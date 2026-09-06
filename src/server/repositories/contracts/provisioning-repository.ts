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
}

export interface ProvisionedTenant {
  readonly tenantId: string;
  readonly tenantCode: string;
  readonly subdomain: string;
  readonly websiteUrl: string | null;
  readonly databaseName: string;
  readonly subscriptionId: string;
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
   * Turns an approved registration into a tenant, its database record and its
   * subscription, and marks the registration approved — all or nothing.
   *
   * A tenant without a database row or without a subscription is not a
   * half-finished tenant, it is a broken one, so the whole set commits together
   * or not at all.
   */
  provisionApprovedTenant(input: ProvisionInput): Promise<ProvisionOutcome>;
  /** Marks a pending registration rejected. Returns false if it was not pending. */
  rejectRegistration(registrationId: string): Promise<boolean>;
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
  /**
   * Rewrites the pointers once the database actually exists.
   *
   * Written after provisioning rather than before it: until the database is
   * created there is nowhere for them to point, and a row full of placeholder
   * text is what stops any connection being opened from it.
   */
  setDatabaseConnection(
    tenantId: string,
    connection: DatabaseConnectionPointers,
  ): Promise<void>;
}

/** Pointers, never credentials (S-03). */
export interface DatabaseConnectionPointers {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly secretReference: string;
}

export interface DatabaseTarget {
  readonly tenantId: string;
  readonly databaseName: string;
  readonly status: ProvisioningStatus;
}
