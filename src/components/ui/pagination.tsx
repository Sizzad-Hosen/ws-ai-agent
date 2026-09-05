import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/format-number";

interface PaginationProps {
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  /** Builds the href for a given zero-based offset. */
  readonly buildHref: (offset: number) => string;
  readonly variant?: "numbered" | "simple";
  /** Noun used in the result summary, e.g. "results", "accounts", "messages". */
  readonly noun?: string;
  readonly className?: string;
}

const WINDOW = 1;

function pageList(current: number, last: number): readonly (number | "gap")[] {
  const pages = new Set<number>([1, last, current]);

  for (let offset = 1; offset <= WINDOW; offset += 1) {
    pages.add(current - offset);
    pages.add(current + offset);
  }

  const ordered = [...pages]
    .filter((page) => page >= 1 && page <= last)
    .sort((a, b) => a - b);

  return ordered.flatMap((page, index) => {
    const previous = ordered[index - 1];
    return previous !== undefined && page - previous > 1
      ? (["gap", page] as const)
      : [page];
  });
}

export function Pagination({
  total,
  limit,
  offset,
  buildHref,
  variant = "numbered",
  noun = "results",
  className,
}: PaginationProps) {
  const safeLimit = limit > 0 ? limit : 1;
  const lastPage = Math.max(1, Math.ceil(total / safeLimit));
  const currentPage = Math.min(lastPage, Math.floor(offset / safeLimit) + 1);
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(total, offset + safeLimit);

  const previousOffset = Math.max(0, offset - safeLimit);
  const nextOffset = offset + safeLimit;
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < lastPage;

  return (
    <div
      className={cn(
        "border-border flex flex-wrap items-center justify-between gap-4 border-t px-5 py-3.5",
        className,
      )}
    >
      <p className="text-muted-foreground text-sm">
        Showing {formatNumber(first)} to {formatNumber(last)} of{" "}
        {formatNumber(total)} {noun}
      </p>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <PageLink
          href={buildHref(previousOffset)}
          disabled={!hasPrevious}
          label="Previous page"
        >
          {variant === "simple" ? (
            "Prev"
          ) : (
            <ChevronLeft className="size-4" aria-hidden="true" />
          )}
        </PageLink>

        {variant === "numbered"
          ? pageList(currentPage, lastPage).map((page, index) =>
              page === "gap" ? (
                <span
                  key={`gap-${index}`}
                  className="text-muted-foreground px-2 text-sm"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <PageLink
                  key={page}
                  href={buildHref((page - 1) * safeLimit)}
                  current={page === currentPage}
                  label={`Page ${page}`}
                >
                  {page}
                </PageLink>
              ),
            )
          : null}

        <PageLink
          href={buildHref(nextOffset)}
          disabled={!hasNext}
          label="Next page"
        >
          {variant === "simple" ? (
            "Next"
          ) : (
            <ChevronRight className="size-4" aria-hidden="true" />
          )}
        </PageLink>
      </nav>
    </div>
  );
}

interface PageLinkProps {
  readonly href: string;
  readonly children: React.ReactNode;
  readonly label: string;
  readonly disabled?: boolean;
  readonly current?: boolean;
}

function PageLink({
  href,
  children,
  label,
  disabled = false,
  current = false,
}: PageLinkProps) {
  const className = cn(
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
    current
      ? "border-primary-deep bg-primary-deep text-primary-foreground"
      : "border-border bg-card text-foreground hover:bg-muted",
  );

  if (disabled) {
    return (
      <span
        className={cn(className, "text-muted-foreground opacity-50")}
        aria-disabled="true"
        aria-label={label}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      aria-label={label}
      aria-current={current ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
