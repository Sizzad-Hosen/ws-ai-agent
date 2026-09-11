import type {
  BillingCycle,
  InvoiceStatus,
  SubscriptionStatus,
} from "@/types/status";

/** `subscriptions` in the master ERD. */
export interface Subscription {
  readonly id: string;
  readonly tenantId: string;
  readonly planId: string;
  readonly billingCycle: BillingCycle;
  readonly status: SubscriptionStatus;
  /**
   * Price agreed at signup, immutable afterwards so catalogue edits never
   * reprice existing subscribers. Nullable for negotiated "Custom" plans
   * (2.7 / D-04).
   */
  readonly priceSnapshot: string | null;
  readonly currency: string;
  readonly startedAt: string;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly cancelledAt: string | null;
}

/** `invoices` in the master ERD. */
export interface Invoice {
  readonly id: string;
  readonly tenantId: string;
  /** Null for an invoice not tied to a subscription. */
  readonly subscriptionId: string | null;
  readonly invoiceNumber: string;
  readonly status: InvoiceStatus;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly currency: string;
}

/**
 * Monthly recurring revenue for one subscription, normalised from its billing
 * cycle. Annual subscriptions divide by twelve.
 *
 * Returns `null` when the subscription carries no price (a negotiated plan), so
 * callers can distinguish "no revenue" from "revenue unknown" rather than
 * silently summing a zero.
 */
export function monthlyRecurringRevenue(
  subscription: Subscription,
): number | null {
  if (subscription.priceSnapshot === null) {
    return null;
  }

  const price = Number(subscription.priceSnapshot);

  if (!Number.isFinite(price)) {
    return null;
  }

  return subscription.billingCycle === "annual" ? price / 12 : price;
}

/** A subscription counts toward MRR only while it is billing. */
export function contributesToMrr(subscription: Subscription): boolean {
  return subscription.status === "active" || subscription.status === "past_due";
}
