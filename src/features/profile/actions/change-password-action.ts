"use server";

import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";

import { passwordChangeSchema } from "@/features/profile/schemas";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/audit-log";
import { requireBoAdmin } from "@/server/auth/authorization";
import { BO_SESSION_COOKIE, hashSessionToken } from "@/server/auth/session";
import { repositories } from "@/server/repositories";

/** Matches the cost the seed and the login path already use. */
const BCRYPT_ROUNDS = 12;

export interface PasswordActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Changes the signed-in administrator's password.
 *
 * The current password is verified against the stored hash before anything is
 * written. An unlocked screen is the common threat here, and asking for the
 * password the attacker does not know is what stops it.
 *
 * Every other session is then revoked. Whoever knew the old password should
 * not keep a live session after it is retired — that is most of the reason a
 * password gets changed. The browser doing the changing keeps its session, so
 * the person doing the right thing is not signed out for it.
 */
export async function changePasswordAction(
  input: unknown,
): Promise<PasswordActionResult> {
  const admin = await requireBoAdmin();
  const parsed = passwordChangeSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { currentPassword, newPassword } = parsed.data;
  const credentials = await repositories.admins.findCredentialsById(admin.id);

  if (!credentials) {
    return {
      success: false,
      message: "That account could not be found. Sign in again.",
    };
  }

  if (!(await compare(currentPassword, credentials.passwordHash))) {
    // Named on the field so the form can point at it, but the message says
    // only that it was wrong — never whether the new one would have been fine.
    return {
      success: false,
      message: "That is not your current password.",
      fieldErrors: { currentPassword: ["Incorrect password."] },
    };
  }

  try {
    await repositories.admins.updatePasswordHash(
      admin.id,
      await hash(newPassword, BCRYPT_ROUNDS),
    );
  } catch (error: unknown) {
    console.error("Unable to change the password.", error);
    return {
      success: false,
      message: "The password could not be changed. Please try again.",
    };
  }

  const revoked = await revokeOtherSessions(admin.id);

  await recordAudit({
    actor: admin,
    action: AUDIT_ACTIONS.PASSWORD_CHANGE,
    entityType: "admin",
    entityId: admin.id,
    // Never the password, old or new, and not the hashes either.
    metadata: { otherSessionsRevoked: revoked },
  });

  return {
    success: true,
    message:
      revoked > 0
        ? `Password changed. ${revoked} other ${revoked === 1 ? "session was" : "sessions were"} signed out.`
        : "Password changed.",
  };
}

/**
 * Revokes the administrator's other sessions, best effort.
 *
 * A failure here must not roll back the password change: the new password is
 * already the live one, and refusing the whole operation would leave the
 * account on the password the holder wanted rid of.
 */
async function revokeOtherSessions(adminId: string): Promise<number> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(BO_SESSION_COOKIE)?.value;

    return await repositories.sessions.revokeOthersForAdmin(
      adminId,
      token ? hashSessionToken(token) : "",
    );
  } catch (error: unknown) {
    console.error(
      `PASSWORD CHANGED BUT SESSIONS NOT REVOKED — admin ${adminId}`,
      error,
    );
    return 0;
  }
}
