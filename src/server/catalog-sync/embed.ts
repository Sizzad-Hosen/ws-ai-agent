import "server-only";

import { CohereClient } from "cohere-ai";

/**
 * Turning catalogue text into vectors.
 *
 * Cohere `embed-v4.0`, because this catalogue is searched in Bangla, Banglish
 * and English and a monolingual model is the reason a shop's Bangla-speaking
 * customers get worse answers than its English-speaking ones. The Python
 * reference reached the same conclusion with `embed-multilingual-v3.0`.
 *
 * 1024 dimensions, matching `vector(1024)` in the migration. The dimension is
 * part of the schema: changing model to one with a different width is a
 * migration, not a config change, which is why it is asserted here rather than
 * trusted.
 */

export const EMBEDDING_MODEL = "embed-v4.0";
export const EMBEDDING_DIMENSIONS = 1024;

/** Cohere's own cap per request; the batch size the runner chunks to. */
export const EMBEDDING_BATCH_SIZE = 96;

export interface Embedder {
  readonly model: string;
  /**
   * Embeds a batch, returning one vector per input in the same order.
   *
   * `inputType` matters to this family of models: a stored document and a
   * search query are embedded differently, and mixing them costs recall.
   */
  embed(
    texts: readonly string[],
    inputType: "search_document" | "search_query",
  ): Promise<readonly number[][]>;
}

class CohereEmbedder implements Embedder {
  readonly model = EMBEDDING_MODEL;

  private readonly client: CohereClient;

  constructor(token: string) {
    this.client = new CohereClient({ token });
  }

  async embed(
    texts: readonly string[],
    inputType: "search_document" | "search_query",
  ): Promise<readonly number[][]> {
    if (texts.length === 0) return [];

    if (texts.length > EMBEDDING_BATCH_SIZE) {
      throw new Error(
        `Batch of ${texts.length} exceeds the ${EMBEDDING_BATCH_SIZE} the provider accepts; chunk before calling.`,
      );
    }

    const response = await this.client.embed({
      texts: [...texts],
      model: this.model,
      inputType,
      // Normalised floats, which is what `vector_cosine_ops` assumes.
      embeddingTypes: ["float"],
    });

    const vectors = extractFloatVectors(response);

    if (vectors.length !== texts.length) {
      throw new Error(
        `Provider returned ${vectors.length} vectors for ${texts.length} inputs.`,
      );
    }

    for (const vector of vectors) {
      if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Provider returned ${vector.length}-dimensional vectors; the schema stores ${EMBEDDING_DIMENSIONS}. ` +
            `Changing model width is a migration, not a configuration change.`,
        );
      }
    }

    return vectors;
  }
}

/**
 * The embeddings response, narrowed.
 *
 * The SDK types `embeddings` as either a bare array or an object keyed by
 * embedding type, depending on what was asked for. This asks for floats, so
 * both shapes are handled rather than cast past.
 */
function extractFloatVectors(response: unknown): readonly number[][] {
  const embeddings = (response as { embeddings?: unknown }).embeddings;

  if (Array.isArray(embeddings)) {
    return embeddings as number[][];
  }

  const float = (embeddings as { float?: unknown } | undefined)?.float;

  if (Array.isArray(float)) {
    return float as number[][];
  }

  throw new Error("Provider response carried no float embeddings.");
}

/**
 * The configured embedder, or null when no credential is available.
 *
 * Null rather than a throw, so a deployment without a key still serves: the
 * storefront's lexical search keeps working and only vector recall is missing.
 * Callers that genuinely cannot proceed — the job runner, the backfill — say so
 * themselves.
 */
export function resolveEmbedder(): Embedder | null {
  const token = process.env.COHERE_API_KEY?.trim();

  return token ? new CohereEmbedder(token) : null;
}

/** Splits work into provider-sized batches. */
export function chunk<T>(
  items: readonly T[],
  size = EMBEDDING_BATCH_SIZE,
): readonly T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push([...items.slice(index, index + size)]);
  }

  return batches;
}

/** pgvector's text input format, which is what a parameterised insert takes. */
export function toVectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}
