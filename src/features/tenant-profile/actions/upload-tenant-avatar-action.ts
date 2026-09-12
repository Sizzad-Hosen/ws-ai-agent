"use server";

import { revalidatePath } from "next/cache";

import { deleteAvatar, saveAvatar } from "@/features/profile/avatar-storage";
import {
  AVATAR_REJECTION_MESSAGES,
  MAX_AVATAR_BYTES,
} from "@/features/profile/image-type";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export interface TenantAvatarResult {
  readonly success: boolean;
  readonly message: string;
  /** The new URL, so the form can show the picture without a round trip. */
  readonly avatarUrl?: string;
}

/**
 * Stores a tenant user's profile picture.
 *
 * Reuses the back office's storage and image inspection rather than repeating
 * them: the rules that make an upload safe — bytes decide the type, not the
 * declared one; the stored name is generated here and the uploaded one thrown
 * away — do not differ because the uploader is a tenant.
 *
 * Two things are tenant-specific. The row updated is in the tenant's own
 * database, reached through the guard, so this cannot write to another
 * workspace. And the filename is namespaced by tenant id, so two tenants
 * cannot collide in the shared upload directory and one tenant's stored
 * filename says nothing about another's.
 *
 * There is no audit entry. `admin_audit_logs` records what platform staff do;
 * a tenant editing their own profile is not a platform action, and the tenant
 * schema models no audit table to put it in.
 */
export async function uploadTenantAvatarAction(
  slug: unknown,
  formData: FormData,
): Promise<TenantAvatarResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant, user } = await requireTenantPage(parsedSlug.data);
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return { success: false, message: "Choose a picture to upload." };
  }

  if (file.size === 0) {
    return { success: false, message: AVATAR_REJECTION_MESSAGES.empty };
  }

  // Checked before the bytes are buffered, so an oversized upload is refused
  // without being read into memory first.
  if (file.size > MAX_AVATAR_BYTES) {
    return { success: false, message: AVATAR_REJECTION_MESSAGES["too-large"] };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await saveAvatar(`${tenant.id}-${user.id}`, bytes);

  if (!stored.ok) {
    return {
      success: false,
      message:
        stored.reason === "write-failed"
          ? "The picture could not be saved. Please try again."
          : AVATAR_REJECTION_MESSAGES[stored.reason],
    };
  }

  let previousUrl: string | null = null;

  try {
    const previous = await tenant.db.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    });

    previousUrl = previous?.avatarUrl ?? null;

    await tenant.db.user.update({
      where: { id: user.id },
      data: { avatarUrl: stored.url },
    });
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

  revalidatePath(tenantHref(parsedSlug.data, "profile"));

  return {
    success: true,
    message: "Profile picture updated.",
    avatarUrl: stored.url,
  };
}
