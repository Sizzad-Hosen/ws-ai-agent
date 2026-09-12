import { describe, expect, it } from "vitest";

import {
  AVATAR_EXTENSIONS,
  AVATAR_IMAGE_TYPES,
  MAX_AVATAR_BYTES,
  detectAvatarImageType,
  inspectAvatarBytes,
} from "./image-type";

/**
 * Avatar uploads are the one place a signed-in administrator writes a file to
 * our own origin, so what counts as an image is a security rule, not a
 * convenience. A file served from our origin runs in our origin: an HTML
 * document accepted as a picture is stored cross-site scripting.
 *
 * The declared content type and the filename both come from the client and are
 * never consulted, which is what these cases pin down.
 */
function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const GIF = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00);

/** "RIFF" + a four-byte length + "WEBP". */
const WEBP = bytes(
  0x52,
  0x49,
  0x46,
  0x46,
  0x24,
  0x00,
  0x00,
  0x00,
  0x57,
  0x45,
  0x42,
  0x50,
);

describe("detectAvatarImageType", () => {
  it("recognises each accepted format by its leading bytes", () => {
    expect(detectAvatarImageType(PNG)).toBe("png");
    expect(detectAvatarImageType(JPEG)).toBe("jpeg");
    expect(detectAvatarImageType(GIF)).toBe("gif");
    expect(detectAvatarImageType(WEBP)).toBe("webp");
  });

  it("rejects HTML, however it is named or declared", () => {
    // The case that matters: this is what a stored-XSS attempt looks like
    // arriving as "avatar.png" with an image/png content type.
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    expect(detectAvatarImageType(html)).toBeNull();
  });

  it("rejects an SVG, which is an image but also a script host", () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect(detectAvatarImageType(svg)).toBeNull();
  });

  it("rejects a RIFF container that is not WebP", () => {
    // "RIFF" alone is not enough — a WAV file starts the same way.
    const wav = bytes(
      0x52,
      0x49,
      0x46,
      0x46,
      0x24,
      0x00,
      0x00,
      0x00,
      0x57,
      0x41,
      0x56,
      0x45,
    );
    expect(detectAvatarImageType(wav)).toBeNull();
  });

  it("rejects a truncated signature rather than reading past the end", () => {
    // A prefix of a real PNG header, and nothing more.
    expect(detectAvatarImageType(bytes(0x89, 0x50))).toBeNull();
    expect(detectAvatarImageType(new Uint8Array())).toBeNull();
    // "RIFF" with no room for the format marker.
    expect(detectAvatarImageType(bytes(0x52, 0x49, 0x46, 0x46))).toBeNull();
  });

  it("has an extension and a media type for every accepted format", () => {
    for (const type of AVATAR_IMAGE_TYPES) {
      expect(AVATAR_EXTENSIONS[type]).toBeTruthy();
    }
  });
});

describe("inspectAvatarBytes", () => {
  it("accepts a real image and names its type", () => {
    expect(inspectAvatarBytes(PNG)).toEqual({ ok: true, type: "png" });
  });

  it("reports an empty file separately from an unsupported one", () => {
    expect(inspectAvatarBytes(new Uint8Array())).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("refuses anything over the size limit", () => {
    const oversized = new Uint8Array(MAX_AVATAR_BYTES + 1);
    oversized.set(PNG);

    expect(inspectAvatarBytes(oversized)).toEqual({
      ok: false,
      reason: "too-large",
    });
  });

  it("accepts an image exactly on the limit", () => {
    // Off-by-one here would reject a file the message says is allowed.
    const exact = new Uint8Array(MAX_AVATAR_BYTES);
    exact.set(PNG);

    expect(inspectAvatarBytes(exact)).toEqual({ ok: true, type: "png" });
  });

  it("refuses a valid-sized file that is not an image", () => {
    const text = new TextEncoder().encode("not an image at all");

    expect(inspectAvatarBytes(text)).toEqual({
      ok: false,
      reason: "unsupported-type",
    });
  });

  it("checks the size before the type, so a huge non-image is not misreported", () => {
    const huge = new TextEncoder().encode("x".repeat(10));
    const oversized = new Uint8Array(MAX_AVATAR_BYTES + 1);
    oversized.set(huge);

    expect(inspectAvatarBytes(oversized)).toEqual({
      ok: false,
      reason: "too-large",
    });
  });
});
