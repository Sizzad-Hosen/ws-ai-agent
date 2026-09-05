import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface TabItem {
  readonly label: string;
  readonly href: string;
  readonly active: boolean;
  readonly badge?: ReactNode;
}

/**
 * Design doc → Tabs: underline style with a 2px emerald active underline, used
 * for primary in-page navigation (screen 12 All / Failed Messages).
 */
export function Tabs({
  items,
  className,
  label,
}: {
  readonly items: readonly TabItem[];
  readonly className?: string;
  readonly label: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn("border-border flex gap-1 border-b", className)}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
            item.active
              ? "border-primary text-primary-deep"
              : "text-muted-foreground hover:text-foreground border-transparent",
          )}
        >
          {item.label}
          {item.badge}
        </Link>
      ))}
    </nav>
  );
}
