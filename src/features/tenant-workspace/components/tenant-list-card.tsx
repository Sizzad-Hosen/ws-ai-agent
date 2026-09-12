import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableScroller, THead } from "@/components/ui/table";

import { buildListHref } from "../pagination";

/**
 * The frame shared by every tenant list screen: a search box, a table and a
 * pager, all driven from the query string.
 *
 * The search is a plain GET form with no JavaScript. That keeps a filtered
 * list linkable and working before hydration, and it is why the field is named
 * `search` rather than being held in component state.
 */
export interface TenantListCardProps {
  /** Path the search form and the pager submit to. */
  readonly basePath: string;
  readonly search: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  /** Plural noun for the pager summary, e.g. "customers". */
  readonly noun: string;
  /** The `<TR>` of `<TH>` cells. */
  readonly head: ReactNode;
  /** The `<TBody>` contents, or the empty row. */
  readonly children: ReactNode;
  readonly searchInputId: string;
}

export function TenantListCard({
  basePath,
  search,
  searchLabel,
  searchPlaceholder,
  total,
  limit,
  offset,
  noun,
  head,
  children,
  searchInputId,
}: TenantListCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="border-border flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <form
          className="relative min-w-64 flex-1"
          role="search"
          action={basePath}
        >
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <label htmlFor={searchInputId} className="sr-only">
            {searchLabel}
          </label>
          <input
            id={searchInputId}
            name="search"
            type="search"
            defaultValue={search}
            placeholder={searchPlaceholder}
            className="border-input bg-card focus-visible:border-ring h-10 w-full rounded-md border pr-3 pl-9 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </form>
      </div>

      <TableScroller>
        <Table>
          <THead>{head}</THead>
          {children}
        </Table>
      </TableScroller>

      <Pagination
        total={total}
        limit={limit}
        offset={offset}
        buildHref={(nextOffset) => buildListHref(basePath, search, nextOffset)}
        variant="simple"
        noun={noun}
      />
    </Card>
  );
}
