import { cn } from "@/lib/utils";

interface SparklineProps {
  readonly points: readonly number[];
  /** Any CSS colour; defaults to the emerald brand stroke. */
  readonly color?: string;
  readonly filled?: boolean;
  readonly className?: string;
  /** Screen-reader description; the graphic itself is decorative without it. */
  readonly label?: string;
}

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 32;

function buildPath(points: readonly number[]): readonly string[] {
  if (points.length < 2) {
    return [];
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = VIEWBOX_WIDTH / (points.length - 1);

  return points.map((point, index) => {
    const x = index * step;
    const y = VIEWBOX_HEIGHT - ((point - min) / span) * VIEWBOX_HEIGHT;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
}

/**
 * Design doc → Metrics & Sparklines: 2px stroke, no fill or a very faint
 * gradient fill.
 */
export function Sparkline({
  points,
  color = "var(--primary)",
  filled = false,
  className,
  label,
}: SparklineProps) {
  const coordinates = buildPath(points);

  if (coordinates.length === 0) {
    return null;
  }

  const line = coordinates.join(" ");
  const area = `0,${VIEWBOX_HEIGHT} ${line} ${VIEWBOX_WIDTH},${VIEWBOX_HEIGHT}`;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full", className)}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {filled ? <polygon points={area} fill={color} opacity={0.12} /> : null}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
