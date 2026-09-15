import "server-only";

import { env } from "@/config/env";
import {
  decryptToken,
  encryptToken,
  readEncryptionKey,
} from "@/lib/whatsapp/crypto";

/**
 * The one place a WhatsApp credential is turned into something storable, and
 * the one place it is turned back.
 *
 * Two secrets belong to a connected number, and they are not interchangeable:
 *
 *  - the **access token**, which authorises calls to the Graph API on the
 *    tenant's behalf;
 *  - the **app secret**, which only exists for a tenant who created their own
 *    Meta app. It is never sent anywhere. It is the key the webhook route
 *    verifies that tenant's deliveries with, because their app signs them,
 *    not ours.
 *
 * Both are held as an AES-256-GCM envelope rather than a pointer into a secret
 * manager. `20260913120000_whatsapp_token_at_rest` made that decision for the
 * token and gave the reason: `SecretProvider` returns null in production, so a
 * reference column resolves to nothing, and a column named `*_reference` that
 * actually contains a secret is one somebody later logs believing it is only
 * an identifier.
 *
 * If a real secret manager ever arrives, it arrives here: the callers below
 * hand over plaintext and receive a column value, and none of them knows which
 * of the two it is.
 *
 * Nothing in this file logs, and nothing puts a secret in an Error message.
 * `SecretStoreError` is deliberately vague for that reason.
 */

export class SecretStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretStoreError";
  }
}

/** What goes in a column, or null when there was nothing to store. */
export type StoredSecret = string | null;

function key(): Buffer {
  try {
    return readEncryptionKey(env.WHATSAPP_TOKEN_ENCRYPTION_KEY);
  } catch (cause: unknown) {
    // Re-thrown rather than propagated: the underlying message names the
    // variable, which is right for a developer at startup and wrong in a
    // response to a shop owner.
    throw new SecretStoreError(
      cause instanceof Error
        ? cause.message
        : "The token encryption key is unusable.",
    );
  }
}

/**
 * Whether this deployment can hold a secret at all.
 *
 * Checked before a connect attempt begins, so a tenant is told up front rather
 * than after pasting a token that then cannot be stored.
 */
export function secretStorageReady(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypts one credential for its column.
 *
 * An empty or absent value stores null rather than an envelope around nothing:
 * the app secret is optional, and `null` is how the webhook route knows to fall
 * back to the platform secret.
 */
export function storeSecret(
  plaintext: string | null | undefined,
): StoredSecret {
  const trimmed = plaintext?.trim() ?? "";
  if (trimmed === "") return null;

  return encryptToken(trimmed, key());
}

/**
 * Reads one credential back.
 *
 * Returns null for a missing column and for an envelope that will not open —
 * a rotated key, a truncated value, a row copied between environments. The
 * caller treats both the same way, because both mean the same thing: this
 * credential cannot be used, and the tenant has to paste it again.
 */
export function readSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;

  try {
    return decryptToken(stored, key());
  } catch {
    return null;
  }
}

/**
 * What a column holds once a credential is withdrawn.
 *
 * Null, not an envelope around an empty string: disconnecting must leave
 * nothing behind that a later read could mistake for a usable credential. The
 * row itself stays — conversations reference it.
 */
export function revokedSecret(): StoredSecret {
  return null;
}
