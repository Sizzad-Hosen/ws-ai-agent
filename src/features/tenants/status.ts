import type { BadgeTone } from "@/components/ui/badge";
import type {
  ProvisioningStatus,
  TenantApprovalStatus,
  WebhookStatus,
  WhatsappConnectionStatus,
} from "@/types/status";

export const TENANT_STATUS_LABELS: Readonly<
  Record<TenantApprovalStatus, string>
> = {
  pending_review: "Pending Review",
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  rejected: "Rejected",
  archived: "Archived",
};

export const TENANT_STATUS_TONES: Readonly<
  Record<TenantApprovalStatus, BadgeTone>
> = {
  pending_review: "warning",
  trial: "warning",
  active: "success",
  suspended: "danger",
  rejected: "danger",
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
