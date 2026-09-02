export interface BillingMetadata {
  readonly id: string;
  readonly tenantId: string;
  readonly billingEmail: string;
  readonly externalCustomerReference: string | null;
  readonly updatedAt: string;
}
