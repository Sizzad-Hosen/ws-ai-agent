import { ChartDataTable, ChartShell } from "@/components/charts/chart-frame";
import { CHART_SERIES } from "@/components/charts/chart-palette";
import type { MessageVolumePoint } from "@/features/dashboard/types";

interface MessageVolumeChartProps {
  readonly points: readonly MessageVolumePoint[];
  readonly formatValue: (value: number) => string;
}

const WIDTH = 320;
const HEIGHT = 120;
const PADDING = 8;

/** Two series on one axis: AI engine volume against WhatsApp volume. */
export function MessageVolumeChart({
  points,
  formatValue,
}: MessageVolumeChartProps) {
  if (points.length < 2) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Not enough data to plot message volume.
      </p>
    );
  }

  const values = points.flatMap((point) => [point.aiEngine, point.whatsapp]);
  const max = Math.max(...values) || 1;
  const step = WIDTH / (points.length - 1);

  const line = (key: "aiEngine" | "whatsapp") =>
    points
      .map((point, index) => {
        const y =
          HEIGHT - PADDING - (point[key] / max) * (HEIGHT - PADDING * 2);
        return `${(index * step).toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

  return (
    <ChartShell>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-28 w-full"
        role="img"
        aria-label="Daily message volume by channel"
      >
        <polyline
          points={line("aiEngine")}
          fill="none"
          stroke={CHART_SERIES[0]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={line("whatsapp")}
          fill="none"
          stroke={CHART_SERIES[1]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <ChartDataTable
        caption="Daily message volume by channel"
        columns={["Day", "AI Engine", "WhatsApp"]}
        rows={points.map((point) => [
          point.day,
          formatValue(point.aiEngine),
          formatValue(point.whatsapp),
        ])}
      />
    </ChartShell>
  );
}
