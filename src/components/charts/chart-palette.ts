/**
 * Categorical palette for back-office charts.
 *
 * Validated with the dataviz six-check validator against the white card surface
 * (`#ffffff`): lightness band, chroma floor, CVD separation (worst adjacent pair
 * ΔE 24.9 deutan), normal-vision floor (ΔE 27.2) and 3:1 contrast all pass.
 *
 * Hues are assigned in fixed order and never cycled. Do not substitute
 * `--primary` (#10b981) here: it measures 2.54:1 against white and fails the
 * contrast check for chart marks. The deeper emerald below is its chart step.
 */
export const CHART_SERIES = ["#059669", "#2563eb", "#d97706"] as const;

export type ChartSeriesColor = (typeof CHART_SERIES)[number];

export const CHART_INK = {
  axis: "var(--muted-foreground)",
  grid: "var(--border)",
  surface: "var(--card)",
} as const;

/** Muted step used for projections and other "not yet observed" marks. */
export const CHART_PROJECTED = "#94a3b8";
