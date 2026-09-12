import { z } from "zod";

/**
 * Validation for the administrator's own profile.
 *
 * Deliberately narrow: `name`, `email` and the avatar are the only columns an
 * administrator may change about themselves. `role` and `status` are not here,
 * because self-service privilege escalation is exactly what a profile form
 * must not offer — a `.strict()` schema rejects them outright rather than
 * quietly ignoring them.
 */

/** Matches `admin_users.name`, varchar(120). */
export const profileDetailsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter your name.")
      .max(120, "Name must be 120 characters or fewer."),
    // Normalised before it is validated, not after: a pasted address arrives
    // with stray spacing and mixed case, and validating first would reject it
    // for whitespace the form was always going to strip. Lowercase because the
    // unique index must not be defeatable by casing.
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(
        z
          .email("Enter a valid email address.")
          .max(190, "Email must be 190 characters or fewer."),
      ),
  })
  .strict();

export type ProfileDetails = z.infer<typeof profileDetailsSchema>;

/** Short enough to be usable, long enough that bcrypt is not the weak link. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * bcrypt silently truncates at 72 bytes, so anything longer adds no strength
 * and would make two different passwords interchangeable.
 */
export const MAX_PASSWORD_LENGTH = 72;

export const passwordChangeSchema = z
  .object({
    // Proves the person at the keyboard is the account holder and not someone
    // who found an unlocked screen. Verified against the hash server-side.
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      )
      .max(
        MAX_PASSWORD_LENGTH,
        `New password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`,
      )
      .refine((value) => /[a-z]/.test(value), {
        message: "Include at least one lowercase letter.",
      })
      .refine((value) => /[A-Z]/.test(value), {
        message: "Include at least one uppercase letter.",
      })
      .refine((value) => /[0-9]/.test(value), {
        message: "Include at least one digit.",
      }),
    confirmPassword: z.string().min(1, "Repeat the new password."),
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    // A "change" that changes nothing would report success and revoke the
    // other sessions for no reason.
    message: "The new password must be different from the current one.",
    path: ["newPassword"],
  });

export type PasswordChange = z.infer<typeof passwordChangeSchema>;
