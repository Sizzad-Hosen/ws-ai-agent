import { APP_CONFIG } from "@/config/app";

import { renderEmail, type RenderedEmail } from "./layout";

/**
 * The two emails a new application produces: a receipt for the applicant and
 * an alert for the review queue.
 *
 * Both are pure functions of their facts. Nothing here reads the environment
 * or the clock — the caller passes the URLs and the timestamp in — so a test
 * can assert on the exact output and a rendered email cannot vary by machine.
 */

/** What both messages are written from. Mirrors the registration row. */
export interface RegistrationFacts {
  readonly registrationCode: string;
  readonly businessName: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly ownerPhone: string;
  readonly industry: string;
  readonly region: string;
  readonly submittedAt: Date;
}

export interface RegistrationMessage extends RenderedEmail {
  readonly subject: string;
}

/** Readable in any mail client, and unambiguous across time zones. */
function formatSubmitted(at: Date): string {
  return `${at.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

/**
 * The applicant's receipt.
 *
 * Deliberately promises nothing about the outcome. The application is queued
 * for a human, and an email that reads like an approval is one the business
 * will quote back when the answer turns out to be no.
 *
 * The registration code is the point of the message: it is the only handle the
 * applicant has on their application when they contact support.
 */
export function registrationReceivedEmail(
  facts: RegistrationFacts,
): RegistrationMessage {
  const rendered = renderEmail({
    title: "We have your application",
    preheader: `Your reference is ${facts.registrationCode}.`,
    greeting: `Hello ${facts.ownerName},`,
    paragraphs: [
      `Thank you for applying for a ${APP_CONFIG.name} workspace for ${facts.businessName}. Your application is with our team for review.`,
      "We check every application by hand, so this takes a little time. You will hear from us by email either way — there is nothing further for you to do right now.",
      "Please keep the reference below. Quote it if you need to contact us about this application.",
    ],
    rows: [
      { label: "Reference", value: facts.registrationCode },
      { label: "Business", value: facts.businessName },
      { label: "Contact", value: facts.ownerEmail },
      { label: "Received", value: formatSubmitted(facts.submittedAt) },
    ],
    closing: `You are receiving this because this address was used to apply for a ${APP_CONFIG.name} workspace. If that was not you, please ignore this message — no account has been created.`,
  });

  return {
    subject: `${APP_CONFIG.name}: we have your application (${facts.registrationCode})`,
    ...rendered,
  };
}

/**
 * The review queue's alert.
 *
 * Carries every field the reviewer would otherwise open the queue to read, so
 * the triage decision — is this worth looking at now — can be made from the
 * notification itself. The link goes to the specific registration rather than
 * the queue, because finding the row again is the tedious part.
 */
export function registrationSubmittedEmail(
  facts: RegistrationFacts,
  reviewUrl: string,
): RegistrationMessage {
  const rendered = renderEmail({
    title: "New workspace application",
    preheader: `${facts.businessName} applied — ${facts.registrationCode}.`,
    paragraphs: [
      `${facts.businessName} has applied for a workspace. It is waiting in the review queue with its verification checklist; no tenant and no database exist until someone approves it.`,
    ],
    rows: [
      { label: "Reference", value: facts.registrationCode },
      { label: "Business", value: facts.businessName },
      { label: "Owner", value: facts.ownerName },
      { label: "Email", value: facts.ownerEmail },
      { label: "Phone", value: facts.ownerPhone },
      { label: "Industry", value: facts.industry },
      { label: "Region", value: facts.region },
      { label: "Received", value: formatSubmitted(facts.submittedAt) },
    ],
    action: { label: "Review this application", url: reviewUrl },
    closing: `Sent by ${APP_CONFIG.name} ${APP_CONFIG.consoleName} because a new application reached the review queue.`,
  });

  return {
    subject: `New application: ${facts.businessName} (${facts.registrationCode})`,
    ...rendered,
  };
}
