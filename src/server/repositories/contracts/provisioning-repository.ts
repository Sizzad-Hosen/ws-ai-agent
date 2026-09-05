export interface ProvisionInput {
  readonly registrationId: string;
  readonly planId: string;
  readonly priceSnapshot: string;
  readonly currency: string;
  /** Root domain for the tenant's site URL; empty leaves it unset. */
  readonly rootDomain: string;
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
}
