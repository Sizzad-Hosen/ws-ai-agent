import type { SubscriptionStatus } from "@/types/status";

export interface Subscription {
  readonly id: string;
  readonly tenantId: string;
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
