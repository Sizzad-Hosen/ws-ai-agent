import type { BadgeTone } from "@/components/ui/badge";
import type {
  ProvisioningStatus,
  TenantDisplayStatus,
  WebhookStatus,
  WhatsappConnectionStatus,
} from "@/types/status";

/*
 * One badge per tenant. The two stored columns collapse into the four statuses
 * `tenantDisplayStatus` derives, because an operator scanning the list reads
 * one status per row, not two.
 */

export const TENANT_STATUS_LABELS: Readonly<
  Record<TenantDisplayStatus, string>
> = {
  pending: "Pending",
  approved: "Approved",
  suspended: "Suspended",
  rejected: "Rejected",
};

export const TENANT_STATUS_TONES: Readonly<
  Record<TenantDisplayStatus, BadgeTone>
> = {
  pending: "warning",
  approved: "success",
  suspended: "danger",
  rejected: "danger",
};

export const WHATSAPP_STATUS_LABELS: Readonly<
  Record<WhatsappConnectionStatus, string>
> = {
  active: "Active",
  auth_required: "Auth Required",
  disconnected: "Disconnected",
};

export const WHATSAPP_STATUS_TONES: Readonly<
  Record<WhatsappConnectionStatus, BadgeTone>
> = {
  active: "success",
  auth_required: "danger",
  disconnected: "neutral",
};

export const WEBHOOK_STATUS_LABELS: Readonly<Record<WebhookStatus, string>> = {
  healthy: "Healthy",
  delayed: "Delayed",
  offline: "Offline",
};

export const WEBHOOK_STATUS_TONES: Readonly<Record<WebhookStatus, BadgeTone>> =
  {
    healthy: "success",
    delayed: "warning",
    offline: "neutral",
  };

export const PROVISIONING_LABELS: Readonly<Record<ProvisioningStatus, string>> =
  {
    pending: "Queued",
    provisioning: "Provisioning",
    ready: "Operational",
    failed: "Failed",
  };

export const PROVISIONING_TONES: Readonly<
  Record<ProvisioningStatus, BadgeTone>
> = {
  pending: "neutral",
  provisioning: "info",
  ready: "success",
  failed: "danger",
};
