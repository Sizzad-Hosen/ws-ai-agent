"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { registrationFormSchema } from "@/features/public-site/registration-schema";
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
 * Note: there is no rate limiting here. The route is anonymous and writes a
 * row, so it can be flooded. That needs an IP or captcha gate before this is
 * exposed publicly — see §2.10 in docs/IMPLEMENTATION_PLAN.md.
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
