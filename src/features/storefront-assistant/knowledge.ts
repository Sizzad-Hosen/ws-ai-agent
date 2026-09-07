import "server-only";

import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import { normalize } from "./language";
import { loadFaq, type FaqEntry } from "./settings";

/**
 * Retrieval over what this shop has written down.
 *
 * The reference agent (`WhatsApp_AI-/src/rag.py`) retrieves policies two ways:
 * a FAISS vector store when an embedding key is configured, and a lexical
 * fallback that filters by tenant. Only the fallback is ported here, for two
 * reasons that are about this codebase rather than about retrieval quality:
 *
 *  - A vector index is a second store that has to be built, kept in sync with
 *    the tenant's edits, and — critically — partitioned per tenant. A shared
 *    index with a metadata filter is one forgotten `filter=` away from
 *    answering one shop's customer out of another shop's policies. Retrieval
 *    from the tenant's own database has no such failure mode.
 *  - A shop's FAQ is tens of entries, not thousands. Token overlap over that
 *    is not an approximation of the right answer; it is the right answer.
 *
 * The retrieved text is passed to the model as reference material, never as
 * instructions — see the prompt in `agent.ts`.
 */

export interface KnowledgeMatch {
  readonly entry: FaqEntry;
  readonly score: number;
}

/** Words too common to say anything about which entry is meant. */
const NOISE = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "do",
  "does",
  "i",
  "you",
  "my",
  "your",
  "it",
  "to",
  "of",
  "for",
  "and",
  "or",
  "in",
  "on",
  "what",
  "how",
  "can",
  "please",
  "ki",
  "kivabe",
  "koto",
  "ase",
  "ache",
  "er",
  "ta",
  "কি",
  "কী",
  "কত",
  "আছে",
  "এর",
  "কিভাবে",
  "কোন",
]);

/**
 * Words, keeping Bangla intact.
 *
 * `\p{M}` is in the keep set for the reason the reference agent flags in its
 * own tokenizer: Bangla vowel signs are combining marks, not letters, so
 * dropping them turns "ডেলিভারি" into four characters and pushes it under
 * every length threshold below.
 */
function tokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(" ")
      .map((token) => token.replace(/[^\p{L}\p{N}\p{M}]/gu, ""))
      .filter((token) => token.length > 1 && !NOISE.has(token)),
  );
}

/**
 * The entries worth showing the model for this question.
 *
 * A match has to share at least two meaningful words, or one that is at least
 * five characters long — a single short word in common ("order") retrieves the
 * whole FAQ and drowns the answer that was actually asked for.
 */
export async function searchKnowledge(
  db: TenantPrismaClient,
  question: string,
  limit = 3,
): Promise<readonly KnowledgeMatch[]> {
  const faq = await loadFaq(db);

  if (faq.length === 0) return [];

  const asked = tokens(question);

  if (asked.size === 0) return [];

  const scored: KnowledgeMatch[] = [];

  for (const entry of faq) {
    const entryTokens = tokens(
      `${entry.question} ${entry.answer} ${entry.answerBangla}`,
    );
    const shared = [...asked].filter((token) => entryTokens.has(token));
    const strong = shared.some((token) => token.length >= 5);

    if (shared.length >= 2 || strong) {
      scored.push({ entry, score: shared.length + (strong ? 1 : 0) });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
