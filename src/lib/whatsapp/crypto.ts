import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Encryption for the access tokens this platform holds on tenants' behalf.
 *
 * A WhatsApp access token can send messages as the tenant's business. Leaking
 * the table leaks the ability to message their customers, so the column holds
 * ciphertext and the key lives outside the database.
 *
 * AES-256-GCM rather than CBC: GCM authenticates as well as encrypts, so a
 * tampered ciphertext fails to decrypt instead of decrypting to rubbish that
 * then gets sent to Meta. A fresh random IV per encryption is what keeps two
 * encryptions of the same token from being recognisably identical.
 *
 * The envelope is `v1.<iv>.<tag>.<ciphertext>`, all base64url. The version
 * prefix is there so the algorithm can change later without guessing what an
 * old row was encrypted with.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

/** AES-256 takes a 32-byte key. */
const KEY_BYTES = 32;

/** 96 bits, which is the IV size GCM is defined for and fastest with. */
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class TokenEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenEncryptionError";
  }
}

/**
 * Reads the key, and refuses anything that is not exactly 32 bytes.
 *
 * A short key is not a weak key here, it is a crash at the first write — which
 * is better found at startup than at the moment a tenant connects.
 */
export function readEncryptionKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new TokenEncryptionError(
      "WHATSAPP_TOKEN_ENCRYPTION_KEY is not set. Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }

  let key: Buffer;

  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new TokenEncryptionError(
      "WHATSAPP_TOKEN_ENCRYPTION_KEY is not valid base64.",
    );
  }

  if (key.length !== KEY_BYTES) {
    throw new TokenEncryptionError(
      `WHATSAPP_TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}.`,
    );
  }

  return key;
}

export function encryptToken(plaintext: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new TokenEncryptionError("The encryption key is the wrong length.");
  }

  // Fresh per encryption. Reusing an IV with GCM is catastrophic, not merely
  // untidy: it leaks the XOR of two plaintexts and breaks authentication.
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptToken(envelope: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new TokenEncryptionError("The encryption key is the wrong length.");
  }

  const parts = envelope.split(".");

  if (parts.length !== 4) {
    throw new TokenEncryptionError("The stored token is not a valid envelope.");
  }

  const [version, ivPart, tagPart, dataPart] = parts as [
    string,
    string,
    string,
    string,
  ];

  if (version !== VERSION) {
    throw new TokenEncryptionError(
      `The stored token uses version "${version}", which this build cannot read.`,
    );
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new TokenEncryptionError("The stored token is malformed.");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // GCM refuses on any tampering, including a wrong key. The cause is not
    // distinguished on purpose: telling a caller which part failed helps an
    // attacker more than it helps us.
    throw new TokenEncryptionError(
      "The stored token could not be decrypted. The key may have changed.",
    );
  }
}

/** True when a value looks like one of our envelopes rather than a raw token. */
export function isEncryptedEnvelope(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${VERSION}.`);
}

/**
 * Constant-time comparison for the onboarding nonce.
 *
 * The nonce is looked up by unique index, so the database has already matched
 * it — but a caller that compares two nonces in application code should not
 * reintroduce a timing signal.
 */
export function noncesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) return false;

  return timingSafeEqual(left, right);
}

/** A URL-safe nonce with 256 bits of entropy. */
export function createNonce(): string {
  return randomBytes(32).toString("base64url");
}
