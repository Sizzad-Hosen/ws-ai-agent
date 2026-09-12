import { describe, expect, it } from "vitest";

import {
  buildListHref,
  DEFAULT_PAGE_SIZE,
  parseListParams,
} from "./pagination";

describe("parseListParams", () => {
  it("defaults to the first page with no search", () => {
    expect(parseListParams({})).toEqual({
      search: "",
      offset: 0,
      limit: DEFAULT_PAGE_SIZE,
    });
  });

  it("trims the search term", () => {
    expect(parseListParams({ search: "  acme  " }).search).toBe("acme");
  });

  it("caps a pathological search term", () => {
    const long = "a".repeat(500);
    expect(parseListParams({ search: long }).search).toHaveLength(100);
  });

  it("reads a positive offset", () => {
    expect(parseListParams({ offset: "40" }).offset).toBe(40);
  });

  it.each([
    ["negative", "-10"],
    ["zero", "0"],
    ["not a number", "abc"],
    ["empty", ""],
  ])("treats a %s offset as the first page", (_label, value) => {
    expect(parseListParams({ offset: value }).offset).toBe(0);
  });

  it("truncates a fractional offset rather than rejecting it", () => {
    // `parseInt` stops at the decimal point. A row offset of 2 is a perfectly
    // valid page start, so there is nothing to guard against here.
    expect(parseListParams({ offset: "2.5" }).offset).toBe(2);
  });

  it("takes the first value when a key repeats in the query string", () => {
    expect(parseListParams({ search: ["first", "second"] }).search).toBe(
      "first",
    );
  });

  it("ignores an array-valued key that is empty", () => {
    expect(parseListParams({ search: [] }).search).toBe("");
  });

  it("honours a caller-supplied page size", () => {
    expect(parseListParams({}, 50).limit).toBe(50);
  });
});

describe("buildListHref", () => {
  it("omits the query string entirely on the first page", () => {
    expect(buildListHref("/acme/tenants_reg/orders", "", 0)).toBe(
      "/acme/tenants_reg/orders",
    );
  });

  it("keeps the search when paging", () => {
    expect(buildListHref("/acme/tenants_reg/orders", "widget", 20)).toBe(
      "/acme/tenants_reg/orders?search=widget&offset=20",
    );
  });

  it("drops the offset when returning to the first page", () => {
    expect(buildListHref("/acme/tenants_reg/orders", "widget", 0)).toBe(
      "/acme/tenants_reg/orders?search=widget",
    );
  });

  it("escapes a search term that would otherwise break the URL", () => {
    expect(buildListHref("/acme/tenants_reg/orders", "a&b=c d", 0)).toBe(
      "/acme/tenants_reg/orders?search=a%26b%3Dc+d",
    );
  });
});
