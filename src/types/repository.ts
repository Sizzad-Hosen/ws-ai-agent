export interface ListQuery {
  readonly limit?: number;
  readonly offset?: number;
  readonly search?: string;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}
