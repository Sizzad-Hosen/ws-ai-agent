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

export function createSecretProvider(
  nodeEnv: string,
  rawSecrets: string | undefined,
): SecretProvider {
  if (nodeEnv === "production" || !rawSecrets) {
    return new UnavailableSecretProvider();
  }

  return new EnvSecretProvider(rawSecrets);
}
