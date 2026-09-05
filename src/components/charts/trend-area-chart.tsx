import {
  ChartDataTable,
  ChartLegend,
  ChartShell,
} from "@/components/charts/chart-frame";
import {
  CHART_PROJECTED,
  CHART_SERIES,
} from "@/components/charts/chart-palette";
import { cn } from "@/lib/utils";

export interface TrendPoint {
  readonly label: string;
  readonly actual: number | null;
  readonly projected: number | null;
}

interface TrendAreaChartProps {
  readonly points: readonly TrendPoint[];
  readonly caption: string;
  readonly formatValue: (value: number) => string;
  readonly className?: string;
}

const WIDTH = 600;
const HEIGHT = 180;
const PADDING_Y = 12;

function scale(value: number, min: number, max: number): number {
  const span = max - min || 1;
  return HEIGHT - PADDING_Y - ((value - min) / span) * (HEIGHT - PADDING_Y * 2);
}

/**
 * Actual against projected on a single axis. The projection is drawn dashed in
 * a muted step so it never reads as an observation.
 */
export function TrendAreaChart({
  points,
  caption,
  formatValue,
  className,
}: TrendAreaChartProps) {
  const values = points.flatMap((point) =>
    [point.actual, point.projected].filter(
      (value): value is number => value !== null,
    ),
  );

  if (values.length < 2) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        Not enough data to plot a trend.
      </p>
    );
  }

  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.04;
  const step = WIDTH / Math.max(1, points.length - 1);

  const coordsFor = (key: "actual" | "projected") =>
    points
      .map((point, index) =>
        point[key] === null
          ? null
          : `${(index * step).toFixed(2)},${scale(point[key], min, max).toFixed(2)}`,
      )
      .filter((value): value is string => value !== null);

  const actualCoords = coordsFor("actual");
  const projectedCoords = coordsFor("projected");
  const lastActual = points.findLast((point) => point.actual !== null);

  return (
    <ChartShell className={className}>
      <ChartLegend
        className="mb-3 justify-end"
        entries={[
          { label: "Actual", color: CHART_SERIES[0] },
          { label: "Projected", color: CHART_PROJECTED, dashed: true },
        ]}
      />

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className={cn("h-44 w-full")}
        role="img"
        aria-label={caption}
      >
        {/* Recessive baseline only — no chart junk. */}
        <line
          x1={0}
          y1={HEIGHT - PADDING_Y}
          x2={WIDTH}
          y2={HEIGHT - PADDING_Y}
          stroke="var(--border)"
          strokeWidth={1}
        />

        {actualCoords.length > 1 ? (
          <>
            <polygon
              points={`0,${HEIGHT - PADDING_Y} ${actualCoords.join(" ")} ${
                (actualCoords.length - 1) * step
              },${HEIGHT - PADDING_Y}`}
              fill={CHART_SERIES[0]}
              opacity={0.1}
            />
            <polyline
              points={actualCoords.join(" ")}
              fill="none"
              stroke={CHART_SERIES[0]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}

        {projectedCoords.length > 1 ? (
          <polyline
            points={projectedCoords.join(" ")}
            fill="none"
            stroke={CHART_PROJECTED}
            strokeWidth={2}
            strokeDasharray="6 5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      {lastActual ? (
        <figcaption className="text-muted-foreground mt-2 text-xs">
          Latest actual{" "}
          <span className="text-foreground tabular font-medium">
            {formatValue(lastActual.actual ?? 0)}
          </span>{" "}
          · {lastActual.label}
        </figcaption>
      ) : null}

      <ChartDataTable
        caption={caption}
        columns={["Period", "Actual", "Projected"]}
        rows={points.map((point) => [
          point.label,
          point.actual === null ? "—" : formatValue(point.actual),
          point.projected === null ? "—" : formatValue(point.projected),
        ])}
      />
    </ChartShell>
  );
}
