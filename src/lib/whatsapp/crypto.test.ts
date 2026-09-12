import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createNonce,
  decryptToken,
  encryptToken,
  isEncryptedEnvelope,
  noncesMatch,
  readEncryptionKey,
  TokenEncryptionError,
} from "./crypto";

const KEY = randomBytes(32);
const TOKEN = "EAABsbCS1iHgBO7ZC" + "x".repeat(180);

describe("readEncryptionKey", () => {
  it("accepts a 32-byte base64 key", () => {
    expect(readEncryptionKey(KEY.toString("base64"))).toHaveLength(32);
  });

  it("refuses a missing key, and says how to make one", () => {
    expect(() => readEncryptionKey(undefined)).toThrow(TokenEncryptionError);
    expect(() => readEncryptionKey(undefined)).toThrow(/randomBytes\(32\)/);
  });

  it.each([
    ["too short", randomBytes(16)],
    ["too long", randomBytes(64)],
  ])("refuses a key that is %s", (_label, key) => {
    expect(() => readEncryptionKey(key.toString("base64"))).toThrow(
      /must decode to 32 bytes/,
    );
  });

  it("refuses an empty key rather than treating it as absent-but-fine", () => {
    expect(() => readEncryptionKey("")).toThrow(TokenEncryptionError);
  });
});

describe("encryptToken and decryptToken", () => {
  it("round-trips a token", () => {
    expect(decryptToken(encryptToken(TOKEN, KEY), KEY)).toBe(TOKEN);
  });

  it("never stores the plaintext", () => {
    expect(encryptToken(TOKEN, KEY)).not.toContain(TOKEN);
    expect(encryptToken(TOKEN, KEY)).not.toContain(TOKEN.slice(0, 20));
  });

  it("produces a different ciphertext every time", () => {
    // A fixed IV would make two encryptions of one token identical, which
    // leaks that two tenants share a token and breaks GCM outright.
    const first = encryptToken(TOKEN, KEY);
    const second = encryptToken(TOKEN, KEY);

    expect(first).not.toBe(second);
    expect(decryptToken(first, KEY)).toBe(decryptToken(second, KEY));
  });

  it("carries a version prefix", () => {
    expect(encryptToken(TOKEN, KEY).startsWith("v1.")).toBe(true);
  });

  it("refuses a ciphertext that was tampered with", () => {
    const envelope = encryptToken(TOKEN, KEY);
    const parts = envelope.split(".");
    const data = Buffer.from(parts[3]!, "base64url");
    data[0] = data[0]! ^ 0xff;
    parts[3] = data.toString("base64url");

    expect(() => decryptToken(parts.join("."), KEY)).toThrow(
      TokenEncryptionError,
    );
  });

  it("refuses a tampered authentication tag", () => {
    const parts = encryptToken(TOKEN, KEY).split(".");
    const tag = Buffer.from(parts[2]!, "base64url");
    tag[0] = tag[0]! ^ 0xff;
    parts[2] = tag.toString("base64url");

    expect(() => decryptToken(parts.join("."), KEY)).toThrow(
      TokenEncryptionError,
    );
  });

  it("refuses the wrong key", () => {
    expect(() =>
      decryptToken(encryptToken(TOKEN, KEY), randomBytes(32)),
    ).toThrow(/could not be decrypted/);
  });

  it.each([
    ["empty", ""],
    ["not an envelope", "just-a-token"],
    ["too few parts", "v1.abc.def"],
    ["too many parts", "v1.a.b.c.d"],
  ])("refuses an envelope that is %s", (_label, envelope) => {
    expect(() => decryptToken(envelope, KEY)).toThrow(TokenEncryptionError);
  });

  it("refuses an unknown version rather than guessing", () => {
    const envelope = encryptToken(TOKEN, KEY).replace("v1.", "v2.");
    expect(() => decryptToken(envelope, KEY)).toThrow(/version "v2"/);
  });

  it("refuses a malformed IV", () => {
    const parts = encryptToken(TOKEN, KEY).split(".");
    parts[1] = Buffer.from("short").toString("base64url");

    expect(() => decryptToken(parts.join("."), KEY)).toThrow(/malformed/);
  });

  it("handles an empty string and multi-byte characters", () => {
    expect(decryptToken(encryptToken("", KEY), KEY)).toBe("");
    expect(decryptToken(encryptToken("টোকেন ✓", KEY), KEY)).toBe("টোকেন ✓");
  });

  it("refuses to encrypt with a wrong-length key", () => {
    expect(() => encryptToken(TOKEN, randomBytes(16))).toThrow(/wrong length/);
  });
});

describe("isEncryptedEnvelope", () => {
  it("recognises our own envelope", () => {
    expect(isEncryptedEnvelope(encryptToken(TOKEN, KEY))).toBe(true);
  });

  it.each([
    ["a raw token", TOKEN],
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
    ["an old secret:// pointer", "secret://tenant/token"],
  ])("rejects %s", (_label, value) => {
    expect(isEncryptedEnvelope(value)).toBe(false);
  });
});

describe("noncesMatch", () => {
  it("accepts an identical nonce", () => {
    const nonce = createNonce();
    expect(noncesMatch(nonce, nonce)).toBe(true);
  });

  it("rejects a different nonce", () => {
    expect(noncesMatch(createNonce(), createNonce())).toBe(false);
  });

  it("rejects nonces of different lengths without throwing", () => {
    expect(noncesMatch("short", "a-much-longer-nonce")).toBe(false);
  });
});

describe("createNonce", () => {
  it("is URL-safe", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(createNonce()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 500 }, () => createNonce()));
    expect(seen.size).toBe(500);
  });

  it("carries 256 bits, so it cannot be guessed", () => {
    // 32 bytes base64url is 43 characters.
    expect(createNonce()).toHaveLength(43);
  });
});
