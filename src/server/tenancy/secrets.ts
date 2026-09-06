import "server-only";

/**
 * Resolution of `tenant_databases.secret_reference` into a usable credential.
 *
 * The ERD is explicit that the column stores a *pointer* into a secret manager
 * and never the credential itself (S-03). That makes secret resolution a port
 * with no adapter in this repository: nothing here should ever hold a tenant
 * database password at rest.
 */

export interface SecretProvider {
  readonly name: string;
  /** Resolves a reference, or null when it cannot be resolved. */
  resolve(reference: string): Promise<string | null>;
}

/**
 * The production shape: no secret manager is configured, so every lookup fails
 * loudly rather than silently degrading. A tenant connection that cannot prove
 * its credentials must not be attempted at all.
 */
export class UnavailableSecretProvider implements SecretProvider {
  readonly name = "unavailable";

  async resolve(): Promise<string | null> {
    return null;
  }
}

/**
 * Development stand-in reading a JSON map from the environment.
 *
 * Refused outside development on purpose: the whole point of the reference
 * indirection is that credentials do not sit in configuration, and an
 * environment variable is configuration.
 */
export class EnvSecretProvider implements SecretProvider {
  readonly name = "env";

  private readonly secrets: Readonly<Record<string, string>>;

  constructor(raw: string) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "TENANT_DB_SECRETS_JSON is not valid JSON. It must be an object mapping secret_reference to password.",
      );
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("TENANT_DB_SECRETS_JSON must be a JSON object.");
    }

    const secrets: Record<string, string> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") {
        throw new Error(
          `TENANT_DB_SECRETS_JSON entry "${key}" must be a string.`,
        );
      }
      secrets[key] = value;
    }

    this.secrets = secrets;
  }

  async resolve(reference: string): Promise<string | null> {
    return this.secrets[reference] ?? null;
  }
}

/**
 * Scheme marking a database this deployment provisioned itself, on the same
 * server and under the same account as the master database.
 *
 * A reference is still a reference: it names *which* credential is wanted, and
 * the provider decides whether it can supply it. What it does not do is store
 * one.
 */
const LOCAL_SCHEME = "local-provisioner://";

export function localSecretReference(databaseName: string): string {
  return `${LOCAL_SCHEME}${databaseName}`;
}

/**
 * Development stand-in for co-located tenant databases.
 *
 * The provisioner creates tenant databases on the master server using the
 * master account, so for those databases the credential is one this process
 * already holds — reading it back from the provisioner connection string
 * invents no new secret and stores nothing.
 *
 * Refused outside development, and refuses any reference that is not its own
 * scheme, so it can never stand in for a real secret manager. A production
 * deployment puts tenant databases somewhere else, under accounts this process
 * has no credential for, which is the entire point.
 */
export class LocalProvisionerSecretProvider implements SecretProvider {
  readonly name = "local-provisioner";

  constructor(private readonly provisionerUrl: string) {}

  async resolve(reference: string): Promise<string | null> {
    if (!reference.startsWith(LOCAL_SCHEME)) return null;

    try {
      return decodeURIComponent(new URL(this.provisionerUrl).password) || null;
    } catch {
      return null;
    }
  }
}

/** Tries each provider in turn; the first to resolve wins. */
export class ChainedSecretProvider implements SecretProvider {
  readonly name: string;

  constructor(private readonly providers: readonly SecretProvider[]) {
    this.name = providers.map((provider) => provider.name).join("+");
  }

  async resolve(reference: string): Promise<string | null> {
    for (const provider of this.providers) {
      const secret = await provider.resolve(reference);
      if (secret !== null) return secret;
    }

    return null;
  }
}

export function createSecretProvider(
  nodeEnv: string,
  rawSecrets: string | undefined,
  provisionerUrl?: string,
): SecretProvider {
  if (nodeEnv === "production") {
    return new UnavailableSecretProvider();
  }

  const providers: SecretProvider[] = [];

  if (rawSecrets) providers.push(new EnvSecretProvider(rawSecrets));
  if (provisionerUrl) {
    providers.push(new LocalProvisionerSecretProvider(provisionerUrl));
  }

  if (providers.length === 0) return new UnavailableSecretProvider();
  if (providers.length === 1) return providers[0]!;

  return new ChainedSecretProvider(providers);
}
