import type { ListQuery, PaginatedResult } from "@/types/repository";

const DEFAULT_LIMIT = 20;

export function paginate<T>(
  items: readonly T[],
  query: ListQuery = {},
): PaginatedResult<T> {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const offset = query.offset ?? 0;

  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  };
}
