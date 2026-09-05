/**
 * Enum members for the master schema.
 *
 * Every enum column in `docs/db/SaaS Master DB — BO + Public Site.png` is drawn
 * simply as `enum` with no members (see 2.6 / D-03 in
 * docs/IMPLEMENTATION_PLAN.md). The members below are the evidence-based
 * proposals from that decision: values visible in the mockups are marked, the
 * rest are conventional defaults awaiting confirmation.
 */

export const ADMIN_STATUSES = ["invited", "active", "suspended"] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

/**
 * `tenants.approval_status`. Screen 02 renders Active / Trial / Suspended and
 * screen 03 renders Pending Review, so this single column currently carries
 * both approval and lifecycle meaning — flagged as D-06.
 */
export const TENANT_APPROVAL_STATUSES = [
  "pending_review",
  "trial",
  "active",
  "suspended",
  "rejected",
  "archived",
] as const;
export type TenantApprovalStatus = (typeof TENANT_APPROVAL_STATUSES)[number];

/** `tenant_registrations.status`. */
export const REGISTRATION_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** `tenant_registration_checks.check_type` — the three items on screen 03. */
export const REGISTRATION_CHECK_TYPES = [
  "business_verification",
  "payment_method_linked",
  "whatsapp_api_approval",
] as const;
export type RegistrationCheckType = (typeof REGISTRATION_CHECK_TYPES)[number];

/** `tenant_registration_checks.status`. */
export const REGISTRATION_CHECK_STATUSES = [
  "pending",
  "passed",
  "failed",
] as const;
export type RegistrationCheckStatus =
  (typeof REGISTRATION_CHECK_STATUSES)[number];

/** `tenant_databases.status`. */
export const PROVISIONING_STATUSES = [
  "pending",
  "provisioning",
  "ready",
  "failed",
] as const;
export type ProvisioningStatus = (typeof PROVISIONING_STATUSES)[number];

/** `subscriptions.billing_cycle` — screen 06 offers monthly and annual pricing. */
export const BILLING_CYCLES = ["monthly", "annual"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

/** `subscriptions.status`. */
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** `invoices.status`. */
export const INVOICE_STATUSES = [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** `ai_providers.status`. */
export const AI_PROVIDER_STATUSES = ["active", "inactive"] as const;
export type AiProviderStatus = (typeof AI_PROVIDER_STATUSES)[number];

/** `public_pages.status`. */
export const PUBLIC_PAGE_STATUSES = ["draft", "published", "archived"] as const;
export type PublicPageStatus = (typeof PUBLIC_PAGE_STATUSES)[number];

/*
 * The types below back screens 11 and 12, which have no tables in the ERD at
 * all (2.2 / D-10). They are modelled here so the presentation layer is
 * complete; persistence waits on that decision.
 */

/** Screen 11 status column: Active / Auth Required. */
export const WHATSAPP_CONNECTION_STATUSES = [
  "active",
  "auth_required",
  "disconnected",
] as const;
export type WhatsappConnectionStatus =
  (typeof WHATSAPP_CONNECTION_STATUSES)[number];

/** Screen 11 webhook column: Healthy / Delayed / Offline. */
export const WEBHOOK_STATUSES = ["healthy", "delayed", "offline"] as const;
export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

/** Screen 11 quality column: Green / Yellow / Red / N/A. */
export const WHATSAPP_QUALITY_RATINGS = [
  "green",
  "yellow",
  "red",
  "unknown",
] as const;
export type WhatsappQualityRating = (typeof WHATSAPP_QUALITY_RATINGS)[number];

/** Screen 12 direction column. */
export const MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

/** Screen 12 status column: Delivered / Read / Failed / Queued. */
export const MESSAGE_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
