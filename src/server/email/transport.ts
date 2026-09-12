import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { env } from "@/config/env";

/**
 * The SMTP connection pool.
 *
 * The only module that knows how mail leaves the process, so moving to a
 * hosted API later means replacing this file and leaving the templates and the
 * callers alone.
 */

let cached: Transporter | null = null;

/**
 * Whether mail is configured to go anywhere.
 *
 * No host means sending is off. That is the deliberate default for CI and for
 * a fresh checkout, because the failure mode of guessing — a hostname that
 * happens to resolve — is a test run emailing a real person.
 */
export function isEmailEnabled(): boolean {
  return env.SMTP_HOST !== "";
}

export function emailTransport(): Transporter {
  cached ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    // A local catcher authenticates nobody, and sending credentials it never
    // asked for makes the handshake fail rather than succeed.
    auth:
      env.SMTP_USER === ""
        ? undefined
        : { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    // Papercut and its siblings present a self-signed certificate. Refusing it
    // in development would mean nothing could be tested locally; refusing it
    // in production is the entire point of TLS, so the environment decides.
    tls: { rejectUnauthorized: env.NODE_ENV === "production" },
    // Sending runs after the response has been sent, where nothing is waiting
    // on it and nothing would notice it hanging. These bound it so a dead SMTP
    // host costs seconds rather than holding the task open until the platform
    // kills it.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return cached;
}

/** Drops the pooled transport. Used by tests that repoint the SMTP host. */
export function resetEmailTransport(): void {
  cached?.close();
  cached = null;
}
