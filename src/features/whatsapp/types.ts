import type {
  WebhookStatus,
  WhatsappConnectionStatus,
  WhatsappQualityRating,
} from "@/types/status";

/**
 * Screen 11 (WhatsApp Accounts).
 *
 * No table for these exists in the ERD (2.2 / D-10). `WhatsappRoutingMetadata`
 * in the committed Prisma schema is not in the ERD and carries none of these
 * fields.
 */
export interface WhatsappAccount {
  readonly id: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly displayName: string;
  readonly phoneNumber: string;
  readonly metaAccountId: string;
  readonly connectionStatus: WhatsappConnectionStatus;
  readonly webhookStatus: WebhookStatus;
  /** Webhook round-trip in milliseconds; `null` when the endpoint is offline. */
  readonly webhookLatencyMs: number | null;
  readonly qualityRating: WhatsappQualityRating;
  readonly messagesToday: number;
  readonly lastEventAt: string | null;
}

export interface WhatsappSummary {
  readonly connectedCount: number;
  readonly connectedDeltaPercent: number | null;
  readonly disconnectedCount: number;
  readonly webhookErrorsLast24h: number;
  readonly messagesToday: number;
  readonly messagesTodayDeltaPercent: number | null;
  readonly connectedTrend: readonly number[];
  readonly disconnectedTrend: readonly number[];
  readonly webhookErrorTrend: readonly number[];
  readonly messagesTrend: readonly number[];
}

export interface WhatsappAccountFilters {
  readonly search?: string;
  readonly connection?: WhatsappConnectionStatus;
}
