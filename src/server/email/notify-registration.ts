import "server-only";

import { env } from "@/config/env";
import { ROUTES } from "@/constants/routes";

import { sendEmail, type EmailResult } from "./send-email";
import {
  registrationReceivedEmail,
  registrationSubmittedEmail,
  type RegistrationFacts,
} from "./templates/registration";

/**
 * The two emails a new application sends: a receipt to the applicant and an
 * alert to the review inbox.
 *
 * They are sent together and neither can stop the other. `sendEmail` does not
 * throw, so a refused recipient on one side still leaves the other delivered —
 * which matters most in the direction people forget: a mistyped applicant
 * address must not be what stops the back office hearing about the
 * application.
 */
export interface RegistrationNotification extends RegistrationFacts {
  /** Used to build the reviewer's direct link into the queue. */
  readonly registrationId: string;
}

export interface RegistrationNotificationResult {
  readonly applicant: EmailResult;
  readonly reviewers: EmailResult;
}

export async function notifyRegistrationSubmitted(
  registration: RegistrationNotification,
): Promise<RegistrationNotificationResult> {
  const { registrationId, ...facts } = registration;

  // Absolute, because a relative path in an email resolves against the mail
  // client and lands nowhere.
  const reviewUrl = new URL(
    ROUTES.bo.registration(registrationId),
    env.NEXT_PUBLIC_APP_URL,
  ).toString();

  const receipt = registrationReceivedEmail(facts);
  const alert = registrationSubmittedEmail(facts, reviewUrl);

  const [applicant, reviewers] = await Promise.all([
    sendEmail({ to: facts.ownerEmail, ...receipt }),
    sendEmail({ to: env.EMAIL_REVIEW_INBOX, ...alert }),
  ]);

  return { applicant, reviewers };
}
