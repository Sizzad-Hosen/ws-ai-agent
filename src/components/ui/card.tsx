import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Design doc → Elevation: Level 1 is a white surface with a 1px solid border
 * and no shadow.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-card border-border rounded-md border", className)}
      {...props}
    />
  );
}

interface CardHeaderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly icon?: ReactNode;
}

export function CardHeader({
  className,
  title,
  description,
  actions,
  icon,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-5 py-4",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? (
          <span className="text-muted-foreground shrink-0" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-headline-sm text-foreground truncate">{title}</h2>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-sm">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardDivider({
  className,
  ...props
}: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn("border-border border-t", className)} {...props} />;
}

interface FieldProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Uppercase micro-label above a value — used across screens 03, 04 and 09. */
export function Field({ label, children, className }: FieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-label-md text-muted-foreground uppercase">{label}</p>
      <div className="text-foreground mt-1.5 text-sm">{children}</div>
    </div>
  );
}
