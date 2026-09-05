import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

export function Breadcrumbs({ items }: { readonly items: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.label} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(isLast && "text-foreground font-medium")}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface PageHeaderProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly breadcrumbs?: readonly Crumb[];
  readonly actions?: ReactNode;
  /** Rendered next to the title — status pills, identifiers. */
  readonly meta?: ReactNode;
  readonly className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-4", className)}>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-headline-lg text-foreground">{title}</h1>
            {meta}
          </div>
          {description ? (
            <p className="text-muted-foreground mt-1.5 text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
