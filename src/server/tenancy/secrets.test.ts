import { describe, expect, it } from "vitest";

import {
  EnvSecretProvider,
  LocalProvisionerSecretProvider,
  UnavailableSecretProvider,
  createSecretProvider,
  localSecretReference,
  type SecretProvider,
} from "./secrets";

/**
 * `secret_reference` points into a secret manager and is never the credential
 * itself (S-03). The property under test is that a connection which cannot
 * prove its credentials is never attempted, and that production never reads a
 * credential out of configuration.
 */
describe("UnavailableSecretProvider", () => {
  it("resolves nothing, so no connection is attempted", () => {
    const provider: SecretProvider = new UnavailableSecretProvider();
    return expect(provider.resolve("tenant/acme/password")).resolves.toBeNull();
  });
});

describe("LocalProvisionerSecretProvider", () => {
  const url = "postgresql://postgres:hunter2@localhost:5432/master";

  it("resolves only its own scheme", async () => {
    const provider = new LocalProvisionerSecretProvider(url);

    await expect(
      provider.resolve(localSecretReference("sp_tenant_acme")),
    ).resolves.toBe("hunter2");
  });

  it("refuses any reference it did not issue", async () => {
    // It stands in for co-located databases only. Answering for an arbitrary
    // reference would make it a substitute for a real secret manager.
    const provider = new LocalProvisionerSecretProvider(url);

    await expect(provider.resolve("tenant/acme/password")).resolves.toBeNull();
    await expect(provider.resolve("vault://acme/db")).resolves.toBeNull();
    await expect(provider.resolve("")).resolves.toBeNull();
  });

  it("resolves to null when the provisioner URL carries no password", async () => {
    const provider = new LocalProvisionerSecretProvider(
      "postgresql://postgres@localhost:5432/master",
    );

    await expect(
      provider.resolve(localSecretReference("sp_tenant_acme")),
    ).resolves.toBeNull();
  });
});

describe("createSecretProvider", () => {
  const url = "postgresql://postgres:hunter2@localhost:5432/master";

  it("refuses every reference in production", async () => {
    // The indirection exists so that credentials are not in configuration. A
    // production deployment must supply a real secret manager or connect to
    // nothing at all.
    const provider = createSecretProvider("production", '{"a":"b"}', url);

    expect(provider.name).toBe("unavailable");
    await expect(
      provider.resolve(localSecretReference("sp_tenant_acme")),
    ).resolves.toBeNull();
  });

  it("chains the env map ahead of the local provisioner in development", async () => {
    const provider = createSecretProvider(
      "development",
      '{"tenant/acme/password":"from-env"}',
      url,
    );

    await expect(provider.resolve("tenant/acme/password")).resolves.toBe(
      "from-env",
    );
    await expect(
      provider.resolve(localSecretReference("sp_tenant_acme")),
    ).resolves.toBe("hunter2");
  });

  it("is unavailable when nothing is configured", async () => {
    const provider = createSecretProvider("development", undefined, undefined);

    expect(provider.name).toBe("unavailable");
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
