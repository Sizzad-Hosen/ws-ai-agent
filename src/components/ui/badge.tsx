import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Design doc → Status Badges: pill shaped, a 10% tint of the semantic colour
 * behind full-opacity text of the same colour.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        success: "bg-success-container text-success-container-foreground",
        warning: "bg-warning-container text-warning-container-foreground",
        danger:
          "bg-destructive-container text-destructive-container-foreground",
        info: "bg-info-container text-info-container-foreground",
        neutral: "bg-neutral-container text-neutral-container-foreground",
      },
      shape: {
        pill: "rounded-full",
        /** Square-ish tag used for plan names in the tenants table. */
        tag: "rounded-sm border px-2",
      },
    },
    defaultVariants: {
      tone: "neutral",
      shape: "pill",
    },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Renders a leading status dot, as on the tenants and messages tables. */
  readonly dot?: boolean;
}

export function Badge({
  className,
  tone,
  shape,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, shape }), className)} {...props}>
      {dot ? (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
