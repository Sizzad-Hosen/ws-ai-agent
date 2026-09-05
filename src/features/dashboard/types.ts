/** Screen 01 (Platform Overview). */

export interface DashboardKpi {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly deltaPercent: number | null;
  readonly accent?: "default" | "success";
  /** Set when the figure has no data source yet — rendered as unavailable. */
  readonly unavailableReason?: string;
}

export interface MrrPoint {
  readonly month: string;
  readonly actual: number | null;
  readonly projected: number | null;
}

export interface MessageVolumePoint {
  readonly day: string;
  readonly aiEngine: number;
  readonly whatsapp: number;
}

export interface ActivityEntry {
  readonly id: string;
  readonly description: string;
  /** Entity to emphasise inside `description`, matched verbatim. */
  readonly subject: string | null;
  readonly source: string;
  readonly occurredAt: string;
  readonly tone: "success" | "info" | "neutral" | "warning";
}

export interface DashboardSummary {
  readonly kpis: readonly DashboardKpi[];
  readonly mrrSeries: readonly MrrPoint[];
  readonly messageVolume: readonly MessageVolumePoint[];
  readonly activity: readonly ActivityEntry[];
  readonly generatedAt: string;
}

export const DASHBOARD_RANGES = ["7d", "30d", "90d"] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export const DASHBOARD_RANGE_LABELS: Readonly<Record<DashboardRange, string>> =
  {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
  };
