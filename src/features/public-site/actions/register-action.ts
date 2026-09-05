"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { registrationFormSchema } from "@/features/public-site/registration-schema";
import {
  checkRegistrationAllowed,
  clientAddress,
  recordRegistration,
} from "@/server/auth/login-throttle";
import { repositories } from "@/server/repositories";

export interface RegisterResult {
  readonly success: boolean;
  readonly message: string;
  /** Shown to the applicant so they can quote it to support. */
  readonly registrationCode?: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Public sign-up.
 *
 * Deliberately unauthenticated — it is the front door. It creates a
 * PENDING_REVIEW row in `tenant_registrations` with its review checklist; no
 * tenant and no database are provisioned until an administrator approves it on
 * screen 03.
 *
 * Anonymous and write-capable, so it is defended twice: a hidden honeypot field
 * catches a bot filling every input it can find, and a per-address sliding
 * window bounds how many applications one source can queue. A submission that
 * trips the honeypot is answered as though it succeeded, because telling a bot
 * why it failed only helps it try again.
 */
export async function registerAction(input: unknown): Promise<RegisterResult> {
  const parsed = registrationFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const values = parsed.data;

  if (values.companyWebsite !== undefined && values.companyWebsite !== "") {
    return { success: true, message: "Application received." };
  }

  const address = await clientAddress();
  const throttle = await checkRegistrationAllowed(address);

  if (!throttle.allowed) {
    return {
      success: false,
      message:
        "Too many applications from this connection. Please try again later, or email us directly.",
    };
  }

  const ownerEmail = values.ownerEmail.trim().toLowerCase();

  try {
    if (await repositories.registrations.existsForEmail(ownerEmail)) {
      return {
        success: false,
        message:
          "There is already an application in progress for this email address. Check your inbox, or contact support if you think this is a mistake.",
        fieldErrors: { ownerEmail: ["This address has already applied."] },
      };
    }

    const registrationCode = await repositories.registrations.create({
      businessName: values.businessName,
      ownerName: values.ownerName,
      ownerEmail,
      ownerPhone: values.ownerPhone,
      industry: values.industry,
      region: values.region,
      // The applicant does not choose a plan; approval assigns one.
      requestedPlanId: null,
    });

    await recordRegistration(address);

    // The back-office queue counts pending registrations in its navigation.
    revalidatePath(ROUTES.bo.registrations);
    revalidatePath(ROUTES.bo.dashboard);

    return {
      success: true,
      message: "Application received.",
      registrationCode,
    };
  } catch (error: unknown) {
    console.error("Unable to record the registration.", error);
    return {
      success: false,
      message:
        "We could not record your application just now. Please try again in a moment.",
    };
  }
}
