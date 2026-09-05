import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface LegendEntry {
  readonly label: string;
  readonly color: string;
  /** Rendered on the right of the entry — e.g. a share percentage. */
  readonly value?: string;
  readonly dashed?: boolean;
}

/**
 * Legend for any chart with two or more series. Identity is never carried by
 * colour alone: every entry pairs a swatch with its text label.
 */
export function ChartLegend({
  entries,
  className,
  orientation = "horizontal",
}: {
  readonly entries: readonly LegendEntry[];
  readonly className?: string;
  readonly orientation?: "horizontal" | "vertical";
}) {
  return (
    <ul
      className={cn(
        "flex gap-x-4 gap-y-2 text-xs",
        orientation === "vertical" ? "flex-col" : "flex-wrap items-center",
        className,
      )}
    >
      {entries.map((entry) => (
        <li
          key={entry.label}
          className={cn(
            "flex items-center gap-2",
            orientation === "vertical" && "justify-between",
          )}
        >
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-sm",
                entry.dashed && "opacity-60",
              )}
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{entry.label}</span>
          </span>
          {entry.value ? (
            <span className="text-foreground tabular font-medium">
              {entry.value}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

interface ChartTableProps {
  readonly caption: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/**
 * Visually hidden equivalent of the chart, so the data is reachable without
 * reading the graphic. Required by the accessibility pass for every chart.
 */
export function ChartDataTable({ caption, columns, rows }: ChartTableProps) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, index) =>
              index === 0 ? (
                <th key={cell} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={`${row[0]}-${index}`}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartShell({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <figure className={cn("m-0", className)}>{children}</figure>;
}
