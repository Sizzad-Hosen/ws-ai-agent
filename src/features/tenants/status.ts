import type { BadgeTone } from "@/components/ui/badge";
import type {
  ProvisioningStatus,
  TenantApprovalStatus,
  TenantStatus,
  WebhookStatus,
  WhatsappConnectionStatus,
} from "@/types/status";

/*
 * Two badges, because a tenant has two statuses. The approval badge answers
 * "was this application accepted"; the lifecycle badge answers "what is this
 * workspace doing". Screen 02 shows the lifecycle, screen 03 the verdict.
 */

export const TENANT_APPROVAL_LABELS: Readonly<
  Record<TenantApprovalStatus, string>
> = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

export const TENANT_APPROVAL_TONES: Readonly<
  Record<TenantApprovalStatus, BadgeTone>
> = {
  pending_review: "warning",
  approved: "success",
  rejected: "danger",
};

export const TENANT_STATUS_LABELS: Readonly<Record<TenantStatus, string>> = {
  provisioning: "Provisioning",
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  archived: "Archived",
};

export const TENANT_STATUS_TONES: Readonly<Record<TenantStatus, BadgeTone>> = {
  provisioning: "info",
  trial: "warning",
  active: "success",
  suspended: "danger",
  archived: "neutral",
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
