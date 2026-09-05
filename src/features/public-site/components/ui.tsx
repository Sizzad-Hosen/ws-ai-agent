import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Public-site primitives.
 *
 * Kept apart from `src/components/ui` on purpose: that set implements the
 * back-office language (soft-square, 6px radius, slate surfaces) and this one
 * implements the marketing language (24px cards, charcoal CTAs, airy rhythm).
 * Sharing a component between them would force one of the two to compromise.
 */

const psButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control text-[15px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /** Solid charcoal, white text, no shadow (DESIGN.md → Buttons). */
        primary: "bg-ps-ink text-white hover:bg-ps-ink/90",
        secondary:
          "border-ps-edge text-ps-ink hover:bg-ps-panel-soft border bg-transparent",
        /** Emerald text, no background — "Learn More" affordances. */
        ghost: "text-ps-brand-deep hover:text-ps-brand-deep/80 px-0",
        onDark: "bg-white text-ps-ink hover:bg-white/90",
      },
      size: {
        sm: "h-10 px-4",
        default: "h-12 px-6",
        lg: "h-14 px-8 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface PsButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof psButtonVariants> {
  readonly asChild?: boolean;
}

export function PsButton({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: PsButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(psButtonVariants({ className, size, variant }))}
      {...props}
    />
  );
}

export function PsCard({
  children,
  className,
  interactive = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  /** Adds the emerald hover glow reserved for "premium" cards. */
  readonly interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-ps-panel border-ps-edge rounded-card border p-6 sm:p-8",
        interactive &&
          "hover:border-ps-brand/30 hover:shadow-float transition-[border-color,box-shadow]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PsSection({
  children,
  className,
  tone = "page",
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone?: "page" | "panel";
}) {
  return (
    <section
      className={cn(
        "section-ps",
        tone === "panel" ? "bg-ps-panel" : "bg-ps-page",
        className,
      )}
    >
      <div className="container-ps">{children}</div>
    </section>
  );
}

export function PsSectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : "items-start",
      )}
    >
      {eyebrow ? (
        <span className="text-ps-brand-deep font-display text-eyebrow uppercase">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-ps-ink font-display text-title-lg text-balance">
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "text-ps-ink-muted text-copy max-w-2xl text-pretty",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

/** Square tile holding a feature icon, per the capability cards. */
export function PsIconTile({
  children,
  tone = "neutral",
}: {
  readonly children: ReactNode;
  readonly tone?: "neutral" | "brand";
}) {
  return (
    <span
      className={cn(
        "rounded-field inline-flex size-11 shrink-0 items-center justify-center",
        tone === "brand"
          ? "bg-ps-brand-wash text-ps-brand-deep"
          : "bg-ps-panel-soft text-ps-ink",
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
