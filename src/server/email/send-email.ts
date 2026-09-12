import "server-only";

import { env } from "@/config/env";

import { emailTransport, isEmailEnabled } from "./transport";

export interface OutgoingEmail {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export type EmailResult =
  | { readonly ok: true; readonly messageId: string }
  /** Nowhere to send it; not a failure, and not worth alarming anyone about. */
  | { readonly ok: false; readonly reason: "disabled" }
  | { readonly ok: false; readonly reason: "send-failed" };

/**
 * Sends one message, and never throws.
 *
 * That is the contract the callers depend on. Email is a notification about
 * work that has already been committed — a registration row exists whether or
 * not its receipt is delivered — so an SMTP outage must not turn a successful
 * application into a failed one. Every caller gets a result to log and none of
 * them has to defend itself with a try/catch.
 *
 * Both an HTML and a text part are required rather than optional, so no
 * message can go out that a plain-text client renders as nothing.
 */
export async function sendEmail(message: OutgoingEmail): Promise<EmailResult> {
  if (!isEmailEnabled()) {
    // Logged rather than dropped silently: in a checkout with no SMTP host the
    // question is always "was it supposed to have sent something", and this is
    // the answer.
    console.info(
      `EMAIL NOT SENT (no SMTP_HOST configured) — to ${message.to}: ${message.subject}`,
    );
    return { ok: false, reason: "disabled" };
  }

  try {
    const sent = await emailTransport().sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    return { ok: true, messageId: sent.messageId };
  } catch (error: unknown) {
    // The subject and recipient, never the body: these messages carry a
    // person's name, phone number and business, and a log is a far less
    // guarded place than an inbox.
    console.error(
      `Unable to send email to ${message.to} ("${message.subject}").`,
      error,
    );
    return { ok: false, reason: "send-failed" };
  }
}
