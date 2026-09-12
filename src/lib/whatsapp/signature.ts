import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verification of Meta's `X-Hub-Signature-256` header.
 *
 * Two properties matter and both are easy to lose.
 *
 * The HMAC covers the **raw** bytes Meta sent. Parsing the body and
 * re-serialising it changes key order, whitespace and unicode escaping, so a
 * signature computed over the re-serialised form will not match a genuine
 * request — and, worse, a verifier written that way tends to get "fixed" by
 * being switched off. The caller must read `await request.text()` before
 * anything touches the body.
 *
 * The comparison is timing-safe. A byte-by-byte `===` returns sooner for a
 * signature that differs early, and that difference is measurable across
 * enough requests; an attacker who can measure it can find a valid signature
 * one byte at a time without ever knowing the secret.
 */

const PREFIX = "sha256=";

/** Hex SHA-256 is 64 characters, so the header is always this long. */
const DIGEST_LENGTH = 64;

export type SignatureFailure =
  /** No header at all. */
  | "missing"
  /** Present but not `sha256=<64 hex characters>`. */
  | "malformed"
  /** Well formed, and not the signature for these bytes. */
  | "mismatch"
  /** No app secret is configured, so nothing can be verified. */
  | "unconfigured";

export type SignatureResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: SignatureFailure };

/** The signature Meta should have sent for these bytes. */
export function computeSignature(rawBody: string, appSecret: string): string {
  return (
    PREFIX +
    createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")
  );
}

export function verifyMetaSignature(
  rawBody: string,
  header: string | null | undefined,
  appSecret: string | undefined,
): SignatureResult {
  if (!appSecret) {
    return { valid: false, reason: "unconfigured" };
  }

  if (header === null || header === undefined || header === "") {
    return { valid: false, reason: "missing" };
  }

  if (!header.startsWith(PREFIX)) {
    return { valid: false, reason: "malformed" };
  }

  const received = header.slice(PREFIX.length);

  // Checked before the compare: `timingSafeEqual` throws on a length mismatch,
  // and a thrown verifier is an unverified request.
  if (received.length !== DIGEST_LENGTH || !/^[0-9a-f]+$/i.test(received)) {
    return { valid: false, reason: "malformed" };
  }

  const expected = computeSignature(rawBody, appSecret).slice(PREFIX.length);

  const equal = timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received.toLowerCase(), "hex"),
  );

  return equal ? { valid: true } : { valid: false, reason: "mismatch" };
}

/**
 * Constant-time comparison of the webhook verify token.
 *
 * Meta sends this once, on the `GET` handshake. It is a shared secret like any
 * other and deserves the same comparison as the signature.
 */
export function verifyTokenMatches(
  received: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !received) return false;

  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");

  // Lengths differ, so there is nothing to compare in constant time — but the
  // answer is still no, and returning it early leaks only the length.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
