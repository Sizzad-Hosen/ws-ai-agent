import type { BadgeTone } from "@/components/ui/badge";

/**
 * Display text and tone for the tenant database's status enums.
 *
 * The enums are stored uppercase in the tenant schema — unlike the master
 * database, which maps uppercase Prisma members onto lowercase Postgres
 * labels. Screens must not render the raw member, so every value each enum can
 * hold is given a label here and the record types make a missing one a compile
 * error rather than a blank cell.
 */

export type TenantUserStatus = "INVITED" | "ACTIVE" | "SUSPENDED";
export type TenantCustomerStatus = "ACTIVE" | "BLOCKED";
export type TenantProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type TenantOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export const USER_STATUS_LABELS: Readonly<Record<TenantUserStatus, string>> = {
  INVITED: "Invited",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
};

export const USER_STATUS_TONES: Readonly<Record<TenantUserStatus, BadgeTone>> =
  {
    INVITED: "warning",
    ACTIVE: "success",
    SUSPENDED: "danger",
  };

export const CUSTOMER_STATUS_LABELS: Readonly<
  Record<TenantCustomerStatus, string>
> = {
  ACTIVE: "Active",
  BLOCKED: "Blocked",
};

export const CUSTOMER_STATUS_TONES: Readonly<
  Record<TenantCustomerStatus, BadgeTone>
> = {
  ACTIVE: "success",
  BLOCKED: "danger",
};

export const PRODUCT_STATUS_LABELS: Readonly<
  Record<TenantProductStatus, string>
> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

export const PRODUCT_STATUS_TONES: Readonly<
  Record<TenantProductStatus, BadgeTone>
> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  ARCHIVED: "warning",
};

export const ORDER_STATUS_LABELS: Readonly<Record<TenantOrderStatus, string>> =
  {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
  };

export const ORDER_STATUS_TONES: Readonly<
  Record<TenantOrderStatus, BadgeTone>
> = {
  PENDING: "warning",
  CONFIRMED: "info",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "neutral",
};
