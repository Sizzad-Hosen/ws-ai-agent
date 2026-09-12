import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  computeSignature,
  verifyMetaSignature,
  verifyTokenMatches,
} from "./signature";

const SECRET = "test-app-secret";
const BODY = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

function sign(body: string, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyMetaSignature", () => {
  it("accepts the signature Meta would send", () => {
    expect(verifyMetaSignature(BODY, sign(BODY), SECRET)).toEqual({
      valid: true,
    });
  });

  it("rejects a body that changed by one byte", () => {
    const signature = sign(BODY);
    const tampered = BODY.replace("whatsapp_business_account", "whatsapp_x");

    expect(verifyMetaSignature(tampered, signature, SECRET)).toEqual({
      valid: false,
      reason: "mismatch",
    });
  });

  it("rejects a signature made with a different secret", () => {
    expect(
      verifyMetaSignature(BODY, sign(BODY, "someone-elses-secret"), SECRET),
    ).toEqual({ valid: false, reason: "mismatch" });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
  ])("reports a %s header as missing", (_label, header) => {
    expect(verifyMetaSignature(BODY, header, SECRET)).toEqual({
      valid: false,
      reason: "missing",
    });
  });

  it.each([
    ["no prefix", "abc123"],
    ["the sha1 prefix Meta used to send", "sha1=abc123"],
    ["too short", "sha256=abc"],
    ["not hex", "sha256=" + "z".repeat(64)],
    ["too long", "sha256=" + "a".repeat(65)],
  ])("reports %s as malformed", (_label, header) => {
    expect(verifyMetaSignature(BODY, header, SECRET)).toEqual({
      valid: false,
      reason: "malformed",
    });
  });

  it("reports a missing app secret rather than passing", () => {
    // The dangerous failure: no secret configured must never read as valid.
    expect(verifyMetaSignature(BODY, sign(BODY), undefined)).toEqual({
      valid: false,
      reason: "unconfigured",
    });
    expect(verifyMetaSignature(BODY, sign(BODY), "")).toEqual({
      valid: false,
      reason: "unconfigured",
    });
  });

  it("accepts an uppercase hex digest", () => {
    const header = sign(BODY).toUpperCase().replace("SHA256=", "sha256=");
    expect(verifyMetaSignature(BODY, header, SECRET).valid).toBe(true);
  });

  it("signs the raw bytes, so re-serialising the body breaks it", () => {
    // The reason the route must read request.text() before parsing. Meta sends
    // whatever bytes it sends; JSON.stringify normalises whitespace, so a
    // parse-then-reserialise loses the exact bytes the HMAC covers.
    const raw = '{"a": 1, "b":  2}';
    const reserialised = JSON.stringify(JSON.parse(raw));

    expect(reserialised).not.toBe(raw);
    expect(verifyMetaSignature(reserialised, sign(raw), SECRET).valid).toBe(
      false,
    );
  });

  it("handles a body with multi-byte characters", () => {
    const body = JSON.stringify({ text: "ভালো চাল আছে?" });
    expect(verifyMetaSignature(body, sign(body), SECRET).valid).toBe(true);
  });

  it("handles an empty body", () => {
    expect(verifyMetaSignature("", sign(""), SECRET).valid).toBe(true);
  });
});

describe("computeSignature", () => {
  it("produces the sha256= prefix and a 64-character digest", () => {
    const signature = computeSignature(BODY, SECRET);

    expect(signature.startsWith("sha256=")).toBe(true);
    expect(signature.slice("sha256=".length)).toHaveLength(64);
  });

  it("round-trips with the verifier", () => {
    expect(
      verifyMetaSignature(BODY, computeSignature(BODY, SECRET), SECRET).valid,
    ).toBe(true);
  });
});

describe("verifyTokenMatches", () => {
  it("accepts an exact match", () => {
    expect(verifyTokenMatches("shared-token", "shared-token")).toBe(true);
  });

  it.each([
    ["a different token", "wrong-token"],
    ["a prefix of the token", "shared"],
    ["a longer token", "shared-token-extra"],
    ["different casing", "Shared-Token"],
  ])("rejects %s", (_label, received) => {
    expect(verifyTokenMatches(received, "shared-token")).toBe(false);
  });

  it.each([
    ["received is null", null, "shared-token"],
    ["received is undefined", undefined, "shared-token"],
    ["received is empty", "", "shared-token"],
    ["expected is undefined", "shared-token", undefined],
    ["expected is empty", "shared-token", ""],
  ])("rejects when %s", (_label, received, expected) => {
    expect(verifyTokenMatches(received, expected)).toBe(false);
  });
});
