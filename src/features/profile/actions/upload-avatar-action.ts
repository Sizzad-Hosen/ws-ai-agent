"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { deleteAvatar, saveAvatar } from "@/features/profile/avatar-storage";
import {
  AVATAR_REJECTION_MESSAGES,
  MAX_AVATAR_BYTES,
} from "@/features/profile/image-type";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/audit-log";
import { requireBoAdmin } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";

export interface AvatarActionResult {
  readonly success: boolean;
  readonly message: string;
  /** The new URL, so the form can show the picture without a round trip. */
  readonly avatarUrl?: string;
}

/**
 * Stores a profile picture chosen from the administrator's computer.
 *
 * The file lands in the upload directory and the row keeps only its URL, which
 * is the split the task asked for: bytes on disk, a reference in Postgres.
 *
 * Three things make this safe to expose. The account is the session's, never
 * the request's. The stored filename is generated here and the uploaded one is
 * discarded, so a crafted name cannot escape the directory. And the image type
 * is decided by the leading bytes, not by the declared content type or the
 * extension, because an HTML file renamed `avatar.png` and served from our own
 * origin is stored XSS rather than a broken image.
 *
 * The size is checked before the bytes are read into memory as well as after,
 * so an oversized upload is refused without being buffered first.
 */
export async function uploadAvatarAction(
  formData: FormData,
): Promise<AvatarActionResult> {
  const admin = await requireBoAdmin();
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return { success: false, message: "Choose a picture to upload." };
  }

  if (file.size === 0) {
    return { success: false, message: AVATAR_REJECTION_MESSAGES.empty };
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return { success: false, message: AVATAR_REJECTION_MESSAGES["too-large"] };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await saveAvatar(admin.id, bytes);

  if (!stored.ok) {
    return {
      success: false,
      message:
        stored.reason === "write-failed"
          ? "The picture could not be saved. Please try again."
          : AVATAR_REJECTION_MESSAGES[stored.reason],
    };
  }

  let previousUrl: string | null;

  try {
    previousUrl = await repositories.admins.updateAvatarUrl(
      admin.id,
      stored.url,
    );
  } catch (error: unknown) {
    console.error("Unable to record the uploaded avatar.", error);
    // The row still points at the old picture, so the file just written is
    // unreferenced. Remove it rather than leaving it behind.
    await deleteAvatar(stored.url);
    return {
      success: false,
      message: "The picture could not be saved. Please try again.",
    };
  }

  // Only once the row points at the replacement, so a failure here costs an
  // orphaned file and never a row pointing at a picture that is gone.
  await deleteAvatar(previousUrl);

  await recordAudit({
    actor: admin,
    action: AUDIT_ACTIONS.AVATAR_UPDATE,
    entityType: "admin",
    entityId: admin.id,
    metadata: { from: previousUrl, to: stored.url, bytes: file.size },
  });

  revalidatePath(ROUTES.bo.profile);
  revalidatePath(ROUTES.bo.root, "layout");

  return {
    success: true,
    message: "Profile picture updated.",
    avatarUrl: stored.url,
  };
}
