import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/config/env";
import { repositories } from "@/server/repositories";

/**
 * The model behind the storefront assistant.
 *
 * Two things are deliberate here.
 *
 * The credential comes from the environment, not from the database. The master
 * schema stores `platform_ai_configurations.secret_reference` — a pointer into
 * a secret manager, never a key (S-01/S-03) — and no secret manager is wired
 * up in this repository, so there is nothing to resolve it with. Reading a key
 * from the environment is the same development stand-in that
 * `src/server/tenancy/secrets.ts` makes for tenant database passwords, and it
 * is replaced the same way: by giving that reference to a real provider.
 *
 * The absence of a key is not an error. The assistant is written to work
 * without a model at all — see `agent.ts` — so an unconfigured deployment gets
 * the deterministic assistant rather than a broken storefront.
 */

export interface AssistantModel {
  readonly client: Anthropic;
  readonly model: string;
}

/**
 * Default when the platform configuration names no Anthropic model.
 *
 * Opus 5 rather than a smaller model: this assistant reads a shop's prices and
 * stock and then takes an order against them, and the cost of a confidently
 * wrong answer to "koyta ache?" is a customer who was told the wrong thing
 * about someone's business.
 */
const DEFAULT_MODEL = "claude-opus-5";

/** How long the platform's model choice is trusted before re-reading it. */
const CONFIG_TTL_MS = 60_000;

interface CachedModelName {
  readonly value: string;
  readonly readAt: number;
}

const globalForAssistant = globalThis as unknown as {
  assistantModelName?: CachedModelName;
};

function apiKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();

  return key ? key : null;
}

/**
 * The model the back office selected, when it selected an Anthropic one.
 *
 * Cached briefly: the storefront asks on every message, and a shop's model
 * choice does not change between two sentences of one conversation.
 */
async function configuredModelName(): Promise<string> {
  const cached = globalForAssistant.assistantModelName;

  if (cached && Date.now() - cached.readAt < CONFIG_TTL_MS) {
    return cached.value;
  }

  let value = DEFAULT_MODEL;

  try {
    const view = await repositories.aiConfiguration.findActive();
    const provider = view.providers.find(
      (candidate) => candidate.id === view.configuration.providerId,
    );
    const model = view.models.find(
      (candidate) => candidate.id === view.configuration.modelId,
    );

    // Only an Anthropic selection is honoured, because this client speaks to
    // Anthropic. A configuration naming another provider falls back rather
    // than sending that provider's model id to this API and failing per turn.
    if (provider?.name.toLowerCase() === "anthropic" && model?.modelName) {
      value = model.modelName;
    }
  } catch (error: unknown) {
    // The storefront must not go down because the back office database is
    // unreachable; the default model is a working answer.
    console.error("Could not read the platform AI configuration.", error);
  }

  globalForAssistant.assistantModelName = { value, readAt: Date.now() };

  return value;
}

/** The configured model, or null when no credential is available. */
export async function resolveAssistantModel(): Promise<AssistantModel | null> {
  const key = apiKey();

  if (!key) return null;

  return {
    client: new Anthropic({
      apiKey: key,
      // A shopper is waiting. A reply that takes longer than this is worse
      // than the deterministic one the caller falls back to.
      timeout: Number(process.env.ASSISTANT_TIMEOUT_MS ?? 20_000),
      maxRetries: env.NODE_ENV === "production" ? 1 : 0,
    }),
    model: await configuredModelName(),
  };
}
