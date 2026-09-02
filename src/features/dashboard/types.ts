export interface DashboardMetric {
  readonly label: string;
  readonly value: number;
  readonly description: string;
}

export interface DashboardSummary {
  readonly metrics: readonly DashboardMetric[];
  readonly generatedAt: string;
}
