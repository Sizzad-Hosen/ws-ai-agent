import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /** Emerald-500 background, white text (design doc → Buttons → Primary). */
        primary: "bg-primary text-primary-foreground hover:bg-primary-deep",
        /** Deep emerald, used for the persistent "New Tenant" call to action. */
        brand:
          "bg-primary-deep text-primary-foreground hover:bg-primary-deep/90",
        /** White background, slate border, slate text. */
        secondary:
          "bg-card border-border text-foreground hover:bg-muted border",
        /** No border or background; slate text, slate-100 on hover. */
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        /** Outlined danger action (screen 03 "Reject", screen 04 "Suspend"). */
        danger:
          "border-destructive/40 text-destructive hover:bg-destructive-container border bg-transparent",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4",
        lg: "h-11 px-6",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  readonly asChild?: boolean;
}

export function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}

export { buttonVariants };
