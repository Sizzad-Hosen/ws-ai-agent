"use server";

import { loginSchema, type LoginActionResult } from "@/features/auth/schemas";
import type { SuccessfulLogin } from "@/server/auth/bo-auth-service";
import {
  checkLoginAllowed,
  clearLoginAttempts,
  clientAddress,
  recordFailedLogin,
} from "@/server/auth/login-throttle";
import { setSessionCookie } from "@/server/auth/session";
import { services } from "@/server/services";

export async function loginAction(input: unknown): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const address = await clientAddress();
  const { email } = parsed.data;

  // Checked before the credential comparison so a flood cannot be used to burn
  // CPU on bcrypt, and so the window is enforced even for a valid password.
  const throttle = await checkLoginAllowed(email, address);

  if (!throttle.allowed) {
    return {
      success: false,
      message:
        "Too many sign-in attempts. Wait a few minutes before trying again.",
    };
  }

  let session: SuccessfulLogin | null;

  try {
    session = await services.auth.login(parsed.data);
  } catch (error: unknown) {
    console.error("BO authentication service unavailable.", error);
    return {
      success: false,
      message: "Sign in is temporarily unavailable. Please try again.",
    };
  }

  if (!session) {
    await recordFailedLogin(email, address);

    // The same message whether the address is unknown or the password is
    // wrong, so the response cannot be used to enumerate administrators.
    return {
      success: false,
      message: "The email or password you entered is incorrect.",
    };
  }

  await clearLoginAttempts(email);
  await setSessionCookie(session.token, session.expiresAt);
  return { success: true };
}
