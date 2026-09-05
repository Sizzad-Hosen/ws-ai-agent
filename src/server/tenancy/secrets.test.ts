import { describe, expect, it } from "vitest";

import {
  EnvSecretProvider,
  UnavailableSecretProvider,
  createSecretProvider,
  type SecretProvider,
} from "./secrets";

/**
 * `secret_reference` points into a secret manager and is never the credential
 * itself (S-03). The property under test is that a connection which cannot
 * prove its credentials is never attempted, and that production never reads a
 * credential out of configuration.
 */
describe("createSecretProvider", () => {
  it("refuses environment secrets in production", () => {
    // The whole point of the indirection is that credentials are not config.
    expect(createSecretProvider("production", '{"a":"b"}').name).toBe(
      "unavailable",
    );
  });

  it("uses environment secrets in development when configured", () => {
    expect(createSecretProvider("development", '{"a":"b"}').name).toBe("env");
  });

  it("falls back to unavailable when nothing is configured", () => {
    expect(createSecretProvider("development", undefined).name).toBe(
      "unavailable",
    );
    expect(createSecretProvider("development", "").name).toBe("unavailable");
  });
});

describe("UnavailableSecretProvider", () => {
  it("resolves nothing, so no connection is attempted", () => {
    const provider: SecretProvider = new UnavailableSecretProvider();
    return expect(provider.resolve("tenant/acme/password")).resolves.toBeNull();
  });
});

describe("EnvSecretProvider", () => {
  it("resolves a known reference and misses an unknown one", async () => {
    const provider = new EnvSecretProvider(
      '{"tenant/acme/password":"hunter2"}',
    );
    await expect(provider.resolve("tenant/acme/password")).resolves.toBe(
      "hunter2",
    );
    await expect(provider.resolve("tenant/other/password")).resolves.toBeNull();
  });

  it("rejects malformed configuration loudly at construction", () => {
    // Failing at startup beats every tenant connection silently failing later.
    expect(() => new EnvSecretProvider("not json")).toThrow();
    expect(() => new EnvSecretProvider("[]")).toThrow();
    expect(() => new EnvSecretProvider("null")).toThrow();
    expect(() => new EnvSecretProvider('{"a":123}')).toThrow();
  });
});
