"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { ROUTES } from "@/constants/routes";
import { registrationFormSchema } from "@/features/public-site/registration-schema";
import {
  checkRegistrationAllowed,
  clientAddress,
  recordRegistration,
} from "@/server/auth/login-throttle";
import { notifyRegistrationSubmitted } from "@/server/email/notify-registration";
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
 *
 * Two emails follow — a receipt for the applicant and an alert for the review
 * inbox — scheduled with `after` so they are sent once the applicant already
 * has their answer. Handing SMTP a turn before the response would put a
 * network round trip the applicant gains nothing from in front of their
 * confirmation, and an unreachable mail server would make a registration that
 * committed perfectly well look like it failed.
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

    const created = await repositories.registrations.create({
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

    // After the response, and outside the try: the row is committed, so a mail
    // failure is not a registration failure and must not be answered as one.
    // `notifyRegistrationSubmitted` does not throw, which is what keeps this
    // callback from becoming an unhandled rejection nobody sees.
    after(async () => {
      const delivered = await notifyRegistrationSubmitted({
        registrationId: created.id,
        registrationCode: created.registrationCode,
        businessName: values.businessName,
        ownerName: values.ownerName,
        ownerEmail,
        ownerPhone: values.ownerPhone,
        industry: values.industry,
        region: values.region,
        submittedAt: new Date(),
      });

      if (
        !delivered.reviewers.ok &&
        delivered.reviewers.reason !== "disabled"
      ) {
        // Worth a line of its own: the applicant has been told to wait for a
        // decision, and nobody has been told there is one to make.
        console.error(
          `REGISTRATION ${created.registrationCode} NOT ANNOUNCED TO REVIEWERS — it is in the queue but no alert was delivered.`,
        );
      }
    });

    // The back-office queue counts pending registrations in its navigation.
    revalidatePath(ROUTES.bo.registrations);
    revalidatePath(ROUTES.bo.dashboard);

    return {
      success: true,
      message: "Application received.",
      registrationCode: created.registrationCode,
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
