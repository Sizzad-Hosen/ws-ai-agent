import {
  ChartDataTable,
  ChartLegend,
  ChartShell,
} from "@/components/charts/chart-frame";
import { CHART_SERIES } from "@/components/charts/chart-palette";
import { cn } from "@/lib/utils";

export interface DonutSlice {
  readonly label: string;
  readonly percent: number;
}

interface DonutChartProps {
  readonly slices: readonly DonutSlice[];
  readonly caption: string;
  /** Short text rendered in the hole — a family name, not a number. */
  readonly centerLabel?: string;
  readonly className?: string;
}

const SIZE = 120;
const RADIUS = 46;
const STROKE = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** 2px surface gap between adjacent arcs. */
const GAP = 2;

export function DonutChart({
  slices,
  caption,
  centerLabel,
  className,
}: DonutChartProps) {
  if (slices.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        No model usage recorded.
      </p>
    );
  }

  // Cumulative start offsets, computed up front so nothing mutates in render.
  const offsets = slices.reduce<number[]>((acc, slice, index) => {
    const previous = index === 0 ? 0 : acc[index - 1];
    const previousLength =
      index === 0 ? 0 : (slices[index - 1].percent / 100) * CIRCUMFERENCE;
    acc.push(previous + previousLength);
    return acc;
  }, []);

  return (
    <ChartShell className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-32"
          role="img"
          aria-label={caption}
        >
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {slices.map((slice, index) => {
              const length = (slice.percent / 100) * CIRCUMFERENCE;
              const dash = Math.max(0, length - GAP);

              return (
                <circle
                  key={slice.label}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={CHART_SERIES[index % CHART_SERIES.length]}
                  strokeWidth={STROKE}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offsets[index]}
                >
                  <title>{`${slice.label}: ${slice.percent}%`}</title>
                </circle>
              );
            })}
          </g>
        </svg>
        {centerLabel ? (
          <span
            className="text-foreground absolute inset-0 grid place-items-center text-sm font-semibold"
            aria-hidden="true"
          >
            {centerLabel}
          </span>
        ) : null}
      </div>

      <ChartLegend
        orientation="vertical"
        className="w-full"
        entries={slices.map((slice, index) => ({
          label: slice.label,
          color: CHART_SERIES[index % CHART_SERIES.length],
          value: `${slice.percent}%`,
        }))}
      />

      <ChartDataTable
        caption={caption}
        columns={["Model", "Share"]}
        rows={slices.map((slice) => [slice.label, `${slice.percent}%`])}
      />
    </ChartShell>
  );
}
