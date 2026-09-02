"use server";

import { loginSchema, type LoginActionResult } from "@/features/auth/schemas";
import { setSessionCookie } from "@/server/auth/session";
import type { SuccessfulLogin } from "@/server/auth/bo-auth-service";
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
    return {
      success: false,
      message: "The email or password you entered is incorrect.",
    };
  }

  await setSessionCookie(session.token, session.expiresAt);
  return { success: true };
}
