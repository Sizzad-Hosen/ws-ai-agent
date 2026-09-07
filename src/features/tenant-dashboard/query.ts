import { z } from "zod";

/**
 * Query parsing shared by every tenant list screen and REST route.
 *
 * One parser so search, paging and sorting behave identically everywhere, and
 * so an unknown sort key can never reach a query builder. Unknown enum values
 * are dropped rather than rejected, matching the back office: a stale bookmark
 * returns a list instead of an error.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .catch(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0).catch(0),
});

export type ListQueryInput = z.infer<typeof listQuerySchema>;

export interface Paginated<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** Blank values are absent values, so `?status=` does not fail validation. */
export function toQueryRecord(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): Record<string, string> {
  const record: Record<string, string> = {};
  const entries =
    params instanceof URLSearchParams ? [...params] : Object.entries(params);

  for (const [key, value] of entries) {
    const single = Array.isArray(value) ? value[0] : value;
    if (typeof single === "string" && single.trim() !== "") {
      record[key] = single;
    }
  }

  return record;
}

/** Builds a querystring href, dropping empty values and a zero offset. */
export function buildListHref(
  base: string,
  params: Readonly<Record<string, string | number | undefined>>,
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === 0) continue;
    query.set(key, String(value));
  }

  const serialized = query.toString();
  return serialized === "" ? base : `${base}?${serialized}`;
}
