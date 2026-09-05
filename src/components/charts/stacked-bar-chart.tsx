import {
  ChartDataTable,
  ChartLegend,
  ChartShell,
} from "@/components/charts/chart-frame";
import { CHART_SERIES } from "@/components/charts/chart-palette";
import { cn } from "@/lib/utils";

export interface StackedBar {
  readonly label: string;
  /** Two segments, bottom first. */
  readonly segments: readonly [number, number];
}

interface StackedBarChartProps {
  readonly bars: readonly StackedBar[];
  readonly seriesLabels: readonly [string, string];
  readonly caption: string;
  readonly formatValue: (value: number) => string;
  readonly className?: string;
}

const HEIGHT = 220;
const GAP_BETWEEN_SEGMENTS = 2;
const BAR_GAP_RATIO = 0.34;

/**
 * Two-segment stacked columns with a 2px surface gap between segments and 4px
 * rounded tops anchored to the baseline.
 */
export function StackedBarChart({
  bars,
  seriesLabels,
  caption,
  formatValue,
  className,
}: StackedBarChartProps) {
  if (bars.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No usage recorded for this period.
      </p>
    );
  }

  const totals = bars.map((bar) => bar.segments[0] + bar.segments[1]);
  const max = Math.max(...totals) || 1;

  const slot = 100 / bars.length;
  const barWidth = slot * (1 - BAR_GAP_RATIO);

  return (
    <ChartShell className={className}>
      {/* Legend lists the upper segment first, matching the stack top-down. */}
      <ChartLegend
        className="mb-3 justify-end"
        entries={[
          { label: seriesLabels[1], color: CHART_SERIES[1] },
          { label: seriesLabels[0], color: CHART_SERIES[0] },
        ]}
      />

      <div className="flex gap-3">
        <div
          className="text-muted-foreground tabular flex flex-col justify-between py-1 text-[11px]"
          aria-hidden="true"
        >
          <span>{formatValue(max)}</span>
          <span>{formatValue(max / 2)}</span>
          <span>0</span>
        </div>

        <svg
          viewBox={`0 0 100 ${HEIGHT}`}
          preserveAspectRatio="none"
          className={cn("h-56 w-full")}
          role="img"
          aria-label={caption}
        >
          {bars.map((bar, index) => {
            const total = bar.segments[0] + bar.segments[1];
            const totalHeight = (total / max) * (HEIGHT - 8);
            const lowerHeight = (bar.segments[0] / max) * (HEIGHT - 8);
            const upperHeight = Math.max(
              0,
              totalHeight - lowerHeight - GAP_BETWEEN_SEGMENTS,
            );
            const x = index * slot + (slot - barWidth) / 2;

            return (
              <g key={bar.label}>
                <title>
                  {`${bar.label} — ${seriesLabels[0]}: ${formatValue(bar.segments[0])}, ${seriesLabels[1]}: ${formatValue(bar.segments[1])}`}
                </title>
                {/* Lower segment sits on the baseline. */}
                <rect
                  x={x}
                  y={HEIGHT - lowerHeight}
                  width={barWidth}
                  height={lowerHeight}
                  fill={CHART_SERIES[0]}
                  rx={1}
                />
                {/* Upper segment, offset by the 2px surface gap. */}
                <rect
                  x={x}
                  y={HEIGHT - lowerHeight - GAP_BETWEEN_SEGMENTS - upperHeight}
                  width={barWidth}
                  height={upperHeight}
                  fill={CHART_SERIES[1]}
                  rx={1}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <ChartDataTable
        caption={caption}
        columns={["Day", seriesLabels[0], seriesLabels[1]]}
        rows={bars.map((bar) => [
          bar.label,
          formatValue(bar.segments[0]),
          formatValue(bar.segments[1]),
        ])}
      />
    </ChartShell>
  );
}
