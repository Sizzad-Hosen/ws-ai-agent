/**
 * Screens 08 and 10 (AI Usage).
 *
 * No usage table exists in the ERD (2.2 / D-10). These types describe the daily
 * rollup that must back the screen; nothing here queries a tenant database at
 * request time.
 */

export interface UsagePoint {
  readonly day: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
}

export interface CostPoint {
  readonly day: string;
  readonly cost: number;
}

export interface ModelShare {
  readonly modelName: string;
  readonly percent: number;
}

export interface TenantUsageRow {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly messages: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly estimatedCost: string;
  readonly currency: string;
}

export interface UsageSummary {
  readonly estimatedCost: string;
  readonly currency: string;
  readonly costDeltaPercent: number | null;
  readonly requests: number;
  readonly averageCostPerConversation: string;
  readonly inputTokens: number;
  readonly errorRatePercent: number;
  readonly tokenSeries: readonly UsagePoint[];
  readonly costSeries: readonly CostPoint[];
  readonly modelDistribution: readonly ModelShare[];
  readonly tenantUsage: readonly TenantUsageRow[];
  /** Rollups are not live; the screen always states its own staleness (P-08). */
  readonly asOf: string;
}

export const USAGE_TIMEFRAMES = ["7d", "30d", "90d"] as const;
export type UsageTimeframe = (typeof USAGE_TIMEFRAMES)[number];

export const USAGE_TIMEFRAME_LABELS: Readonly<Record<UsageTimeframe, string>> =
  {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
  };
