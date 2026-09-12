import { describe, expect, it } from "vitest";

import {
  hasUnknownBaseline,
  pendingMigrations,
  TENANT_BASELINE,
  TENANT_INCREMENTAL_MIGRATIONS,
  TENANT_MIGRATIONS,
  TENANT_SCHEMA_VERSION,
} from "./migrations";

describe("the migration list", () => {
  it("starts at the baseline and ends at the current version", () => {
    expect(TENANT_MIGRATIONS[0]).toBe(TENANT_BASELINE);
    expect(TENANT_MIGRATIONS.at(-1)?.version).toBe(TENANT_SCHEMA_VERSION);
  });

  it("has no duplicate versions", () => {
    const versions = TENANT_MIGRATIONS.map((migration) => migration.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("is ordered so versions sort lexically in apply order", () => {
    const versions = TENANT_MIGRATIONS.map((migration) => migration.version);
    expect([...versions].sort()).toEqual(versions);
  });

  it("has no duplicate files", () => {
    const files = TENANT_MIGRATIONS.map((migration) => migration.file);
    expect(new Set(files).size).toBe(files.length);
  });
});

describe("pendingMigrations", () => {
  it("never returns the baseline, even for a database recording nothing", () => {
    // The runner only ever sees a provisioned database. Re-applying the
    // baseline there fails on the first CREATE TYPE.
    expect(pendingMigrations([])).not.toContain(TENANT_BASELINE);
  });

  it("returns every incremental migration for a database at the baseline", () => {
    expect(pendingMigrations([TENANT_BASELINE.version])).toEqual(
      TENANT_INCREMENTAL_MIGRATIONS,
    );
  });

  it("returns nothing for a fully migrated database", () => {
    const all = TENANT_MIGRATIONS.map((migration) => migration.version);
    expect(pendingMigrations(all)).toEqual([]);
  });

  it("returns the incrementals for a database at an unknown older baseline", () => {
    // The case that broke the first run of the sweep: a database provisioned
    // by an older build records a version this list has never heard of.
    expect(pendingMigrations(["2026.09.2"])).toEqual(
      TENANT_INCREMENTAL_MIGRATIONS,
    );
  });

  it("fills a skipped middle migration rather than judging by count", () => {
    const skipped = TENANT_INCREMENTAL_MIGRATIONS[0];

    if (!skipped) {
      // Nothing to assert while the baseline is the only migration.
      expect(TENANT_INCREMENTAL_MIGRATIONS).toEqual([]);
      return;
    }

    const applied = TENANT_MIGRATIONS.map(
      (migration) => migration.version,
    ).filter((version) => version !== skipped.version);

    expect(pendingMigrations(applied)).toEqual([skipped]);
  });

  it("ignores a recorded version this build does not know", () => {
    const all = TENANT_MIGRATIONS.map((migration) => migration.version);
    expect(pendingMigrations([...all, "2099.01.1"])).toEqual([]);
  });
});

describe("hasUnknownBaseline", () => {
  it("is false for an empty database", () => {
    expect(hasUnknownBaseline([])).toBe(false);
  });

  it("is false when a known version is recorded", () => {
    expect(hasUnknownBaseline([TENANT_BASELINE.version])).toBe(false);
  });

  it("is true when only unknown versions are recorded", () => {
    expect(hasUnknownBaseline(["2026.09.2"])).toBe(true);
  });

  it("is false when an unknown version sits beside a known one", () => {
    expect(hasUnknownBaseline(["2026.09.2", TENANT_BASELINE.version])).toBe(
      false,
    );
  });
});
