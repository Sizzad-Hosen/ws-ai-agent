import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a bundler guard for Next, not a runtime constraint.
      // Unit tests import server modules directly, so it resolves to a no-op.
      "server-only": fileURLToPath(
        new URL("./src/test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    // Unit tests only: pure domain logic with no database or network. The
    // repository-backed flows are covered by the verify:* scripts, which need a
    // live Postgres and so do not belong in the same run.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
