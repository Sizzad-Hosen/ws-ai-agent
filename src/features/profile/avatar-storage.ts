import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/config/env";

import {
  AVATAR_EXTENSIONS,
  inspectAvatarBytes,
  type AvatarRejection,
} from "./image-type";

/**
 * Avatar files on local disk.
 *
 * The only module that touches the filesystem, so swapping in object storage
 * later means replacing this file and leaving the action and the form alone.
 *
 * Local disk is a deliberate limitation, not an oversight: the files do not
 * survive a container rebuild and are not shared between instances. That is
 * fine for a single-server deployment and wrong for anything larger.
 */

export type AvatarSaveResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly reason: AvatarRejection | "write-failed" };

/**
 * The stored filename for an admin's avatar.
 *
 * Built entirely from the admin's id, a random suffix and an extension we
 * chose — never from the uploaded filename, which is attacker-controlled and
 * is the usual way a write escapes its directory. Nothing here can contain a
 * separator or a `..`, so the path cannot traverse.
 *
 * The random suffix also busts the browser cache: the URL changes with every
 * upload, so a new picture appears immediately instead of after a hard reload.
 */
export function avatarFileName(adminId: string, extension: string): string {
  const safeId = adminId.replaceAll(/[^a-zA-Z0-9-]/g, "");
  const suffix = randomBytes(8).toString("hex");

  return `${safeId}-${suffix}.${extension}`;
}

/**
 * Writes an avatar and returns the URL to store on the admin row.
 *
 * Validates the bytes before writing, so an unsupported or oversized file
 * never reaches the disk at all.
 */
export async function saveAvatar(
  adminId: string,
  bytes: Uint8Array,
): Promise<AvatarSaveResult> {
  const inspection = inspectAvatarBytes(bytes);

  if (!inspection.ok) {
    return { ok: false, reason: inspection.reason };
  }

  const fileName = avatarFileName(adminId, AVATAR_EXTENSIONS[inspection.type]);
  const directory = path.resolve(env.AVATAR_UPLOAD_DIR);

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, fileName), bytes);
  } catch (error: unknown) {
    console.error("Unable to write the uploaded avatar.", error);
    return { ok: false, reason: "write-failed" };
  }

  return { ok: true, url: `${env.AVATAR_URL_BASE}/${fileName}` };
}

/**
 * Removes a previously stored avatar, best effort.
 *
 * Called after the row already points at the replacement, so a failure here
 * leaves an orphaned file and nothing worse — never a row pointing at a file
 * that is gone. URLs from outside our own upload base are ignored, so this
 * can never be talked into deleting an arbitrary path.
 */
export async function deleteAvatar(url: string | null): Promise<void> {
  if (!url?.startsWith(`${env.AVATAR_URL_BASE}/`)) return;

  const fileName = path.basename(url);
  const directory = path.resolve(env.AVATAR_UPLOAD_DIR);
  const target = path.join(directory, fileName);

  // `basename` already strips any traversal, and this re-checks the result
  // rather than trusting that reasoning.
  if (path.dirname(target) !== directory) return;

  try {
    await unlink(target);
  } catch {
    // Already gone, or never written. Either way there is nothing to do.
  }
}
