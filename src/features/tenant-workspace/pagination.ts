/**
 * Reading list parameters out of a URL.
 *
 * Pure, so it can be tested without a request. Every tenant list screen keeps
 * its state in the query string, which is what makes a filtered view something
 * a tenant can bookmark or send to a colleague.
 */

export const DEFAULT_PAGE_SIZE = 20;

/** Longest search term accepted, so a pathological URL cannot reach the database. */
const MAX_SEARCH_LENGTH = 100;

export interface ListParams {
  readonly search: string;
  readonly offset: number;
  readonly limit: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}

/**
 * A negative, fractional, absent or non-numeric offset all mean "the first
 * page". Rejecting them instead would turn a hand-edited URL into an error
 * page for no gain.
 */
export function parseListParams(
  params: RawParams,
  limit: number = DEFAULT_PAGE_SIZE,
): ListParams {
  const search = firstValue(params.search).trim().slice(0, MAX_SEARCH_LENGTH);
  const parsed = Number.parseInt(firstValue(params.offset), 10);
  const offset = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  return { search, offset, limit };
}

/**
 * Builds the href for a page of a list, preserving the current search.
 *
 * The first page omits `offset` entirely, so the canonical URL of a list has
 * no query noise on it.
 */
export function buildListHref(
  basePath: string,
  search: string,
  offset: number,
): string {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (offset > 0) query.set("offset", String(offset));

  const serialized = query.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
}
