/**
 * Image type detection for uploaded avatars.
 *
 * Pure and dependency-free so it can be tested without touching a disk, and so
 * the rule that decides what may be written is one readable function.
 *
 * The browser's declared `Content-Type` and the filename extension are both
 * attacker-controlled and are not consulted. Only the leading bytes decide,
 * because an HTML file renamed to `avatar.png` and served from our own origin
 * is a stored cross-site scripting vector, not a broken image.
 */

export const AVATAR_IMAGE_TYPES = ["png", "jpeg", "webp", "gif"] as const;

export type AvatarImageType = (typeof AVATAR_IMAGE_TYPES)[number];

/** Largest upload accepted, before any re-encoding. */
export const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

/** The extension each accepted type is stored under. */
export const AVATAR_EXTENSIONS: Readonly<Record<AvatarImageType, string>> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  gif: "gif",
};

/** The media type each accepted type is served as. */
export const AVATAR_MEDIA_TYPES: Readonly<Record<AvatarImageType, string>> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** What the file picker offers. A convenience, never a check. */
export const AVATAR_ACCEPT_ATTRIBUTE =
  Object.values(AVATAR_MEDIA_TYPES).join(",");

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;

  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * The image type these bytes actually are, or null if they are not an image we
 * accept.
 *
 * Null is the answer for anything unrecognised, which is the whole point: the
 * caller writes nothing unless this returns a type.
 */
export function detectAvatarImageType(
  bytes: Uint8Array,
): AvatarImageType | null {
  // \x89 P N G \r \n \x1a \n
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }

  // JPEG starts with the Start-of-Image marker.
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }

  // "GIF87a" or "GIF89a".
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
    return "gif";
  }

  // WebP is a RIFF container: "RIFF" then four length bytes then "WEBP", so
  // the second marker has to be checked at its own offset.
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return "webp";
  }

  return null;
}

export type AvatarRejection =
  | "empty"
  | "too-large"
  /** Not one of the types above, whatever the upload claimed to be. */
  | "unsupported-type";

export type AvatarInspection =
  | { readonly ok: true; readonly type: AvatarImageType }
  | { readonly ok: false; readonly reason: AvatarRejection };

/** Size and type together, so a caller has one thing to check. */
export function inspectAvatarBytes(bytes: Uint8Array): AvatarInspection {
  if (bytes.length === 0) return { ok: false, reason: "empty" };

  if (bytes.length > MAX_AVATAR_BYTES) {
    return { ok: false, reason: "too-large" };
  }

  const type = detectAvatarImageType(bytes);

  return type === null
    ? { ok: false, reason: "unsupported-type" }
    : { ok: true, type };
}

/** What to tell the person who uploaded it. */
export const AVATAR_REJECTION_MESSAGES: Readonly<
  Record<AvatarRejection, string>
> = {
  empty: "That file is empty. Choose a picture and try again.",
  "too-large": `That picture is larger than ${Math.round(
    MAX_AVATAR_BYTES / (1024 * 1024),
  )} MB. Choose a smaller one.`,
  "unsupported-type":
    "That file is not a PNG, JPEG, WebP or GIF image. Choose a picture and try again.",
};
