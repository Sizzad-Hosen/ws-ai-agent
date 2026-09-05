/**
 * Stands in for the `server-only` package under vitest.
 *
 * That package throws on import outside a React Server Component, which is the
 * correct behaviour for a Next build and the wrong behaviour for a unit test
 * importing a server module directly. Aliased in vitest.config.ts only; the
 * real guard still applies to every application build.
 */
export {};
