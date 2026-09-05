import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";

export interface MetricDelta {
  /** Signed percentage change against the comparable prior period. */
  readonly percent: number;
  readonly label?: string;
}

interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly delta?: MetricDelta | null;
  readonly caption?: string;
  readonly sparkline?: readonly number[];
  readonly sparklineColor?: string;
  readonly accent?: "default" | "success";
  readonly trailing?: ReactNode;
  readonly className?: string;
}

/**
 * Design doc → Metrics: label above the value, headline-md value, optional
 * sparkline. A delta chip renders only when a comparable prior period exists —
 * a missing comparison is omitted rather than shown as +0%.
 */
export function MetricCard({
  label,
  value,
  delta,
  caption,
  sparkline,
  sparklineColor,
  accent = "default",
  trailing,
  className,
}: MetricCardProps) {
  const isPositive = (delta?.percent ?? 0) >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div
      className={cn(
        "bg-card border-border flex flex-col justify-between rounded-md border p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-label-md text-muted-foreground uppercase">{label}</p>
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              isPositive
                ? "bg-success-container text-success-container-foreground"
                : "bg-destructive-container text-destructive-container-foreground",
            )}
          >
            <TrendIcon className="size-3" aria-hidden="true" />
            {isPositive ? "+" : ""}
            {delta.percent}%
          </span>
        ) : null}
        {trailing}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <p
          className={cn(
            "text-headline-md",
            accent === "success" ? "text-success" : "text-foreground",
          )}
        >
          {value}
        </p>
        {caption ? (
          <span className="text-muted-foreground text-xs">{caption}</span>
        ) : null}
      </div>

      {sparkline && sparkline.length > 1 ? (
        <Sparkline
          points={sparkline}
          color={sparklineColor}
          className="mt-4"
          label={`${label} trend`}
        />
      ) : null}
    </div>
  );
}
