import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Design doc → Tables: light slate header, 13px cells, horizontal-only 1px
 * borders, very subtle row hover. Wide tables scroll inside their own
 * container so the page body never scrolls horizontally.
 */
export function TableScroller({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export function Table({
  className,
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full min-w-max border-collapse text-left", className)}
      {...props}
    />
  );
}

export function THead({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("bg-table-header border-border border-b", className)}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(className)} {...props} />;
}

export function TR({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-table-border hover:bg-table-row-hover border-b transition-colors last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  readonly numeric?: boolean;
}

export function TH({ className, numeric = false, ...props }: THProps) {
  return (
    <th
      scope="col"
      className={cn(
        "text-foreground px-4 py-3 text-xs font-semibold",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  readonly numeric?: boolean;
  readonly mono?: boolean;
}

export function TD({
  className,
  numeric = false,
  mono = false,
  ...props
}: TDProps) {
  return (
    <td
      className={cn(
        "text-foreground px-4 py-3 align-middle text-[13px]",
        numeric && "tabular text-right",
        mono && "tabular",
        className,
      )}
      {...props}
    />
  );
}

interface TableEmptyProps {
  readonly colSpan: number;
  readonly title: string;
  readonly description?: string;
}

export function TableEmpty({ colSpan, title, description }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center">
        <p className="text-foreground text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            {description}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
