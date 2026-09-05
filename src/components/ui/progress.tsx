import { cn } from "@/lib/utils";

interface ProgressProps {
  readonly value: number;
  readonly max?: number;
  readonly label: string;
  /** Percentage at which the bar switches to the warning colour. */
  readonly warningThreshold?: number;
  /** Percentage at which the bar switches to the danger colour. */
  readonly dangerThreshold?: number;
  readonly className?: string;
}

export function Progress({
  value,
  max = 100,
  label,
  warningThreshold = 80,
  dangerThreshold = 90,
  className,
}: ProgressProps) {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100));

  const tone =
    percent >= dangerThreshold
      ? "bg-destructive"
      : percent >= warningThreshold
        ? "bg-warning"
        : "bg-primary";

  return (
    <div
      className={cn(
        "bg-muted h-1.5 w-full overflow-hidden rounded-full",
        className,
      )}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all", tone)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
