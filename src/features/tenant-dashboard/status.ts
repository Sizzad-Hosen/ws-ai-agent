import type { BadgeTone } from "@/components/ui/badge";

/**
 * Enum members of the tenant schema, as plain string tuples.
 *
 * Declared here rather than imported from `@/generated/tenant`: these lists are
 * read by filter controls and tables, which are Client Components, and pulling
 * the Prisma client into a browser bundle fails the build. The values mirror
 * `prisma/tenant/schema.prisma` [T-01] and are checked against it by the
 * services, which do type against the generated client.
 */

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatusValue = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Readonly<
  Record<ProductStatusValue, string>
> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

export const PRODUCT_STATUS_TONES: Readonly<
  Record<ProductStatusValue, BadgeTone>
> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  ARCHIVED: "warning",
};

export const CUSTOMER_STATUSES = ["ACTIVE", "BLOCKED"] as const;
export type CustomerStatusValue = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_STATUS_LABELS: Readonly<
  Record<CustomerStatusValue, string>
> = {
  ACTIVE: "Active",
  BLOCKED: "Blocked",
};

export const CUSTOMER_STATUS_TONES: Readonly<
  Record<CustomerStatusValue, BadgeTone>
> = {
  ACTIVE: "success",
  BLOCKED: "danger",
};

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatusValue, string>> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const ORDER_STATUS_TONES: Readonly<Record<OrderStatusValue, BadgeTone>> =
  {
    PENDING: "warning",
    CONFIRMED: "info",
    PROCESSING: "info",
    SHIPPED: "info",
    DELIVERED: "success",
    CANCELLED: "danger",
    REFUNDED: "danger",
  };

export const PAYMENT_STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Readonly<
  Record<PaymentStatusValue, string>
> = {
  PENDING: "Pending",
  AUTHORIZED: "Authorized",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUS_TONES: Readonly<
  Record<PaymentStatusValue, BadgeTone>
> = {
  PENDING: "warning",
  AUTHORIZED: "info",
  PAID: "success",
  FAILED: "danger",
  REFUNDED: "neutral",
};

/** Options for a filter control: every member, behind an "all" entry. */
export function statusFilterOptions<T extends string>(
  values: readonly T[],
  labels: Readonly<Record<T, string>>,
  allLabel: string,
): readonly { value: string; label: string }[] {
  return [
    { value: "", label: allLabel },
    ...values.map((value) => ({ value, label: labels[value] })),
  ];
}
