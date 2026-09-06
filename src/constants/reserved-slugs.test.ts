import { describe, expect, it } from "vitest";

import { ROUTES } from "./routes";
import { isReservedTenantSlug } from "./reserved-slugs";

/**
 * Tenant sites are served from the application root, so a tenant slug and a
 * top-level route share one namespace. A tenant that claimed a route's segment
 * would not shadow the page — Next.js resolves the static route first — it
 * would simply never resolve, with nothing anywhere to explain why.
 */
describe("isReservedTenantSlug", () => {
  it("reserves the first segment of every public route", () => {
    for (const path of Object.values(ROUTES.public)) {
      const segment = path.split("/").filter(Boolean)[0];
      if (segment === undefined) continue;

      expect(
        isReservedTenantSlug(segment),
        `"${segment}" is a public route but is not reserved`,
      ).toBe(true);
    }
  });

  it("reserves the console and the API", () => {
    expect(isReservedTenantSlug("bo")).toBe(true);
    expect(isReservedTenantSlug("api")).toBe(true);
  });

  it("is case-insensitive", () => {
    // The slug is lower-cased before lookup, but a caller that forgets must not
    // be handed a reserved path.
    expect(isReservedTenantSlug("BO")).toBe(true);
    expect(isReservedTenantSlug("Pricing")).toBe(true);
  });

  it("leaves ordinary business slugs alone", () => {
    expect(isReservedTenantSlug("clickeibazar")).toBe(false);
    expect(isReservedTenantSlug("acme-corp")).toBe(false);
  });
});
