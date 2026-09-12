import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  /**
   * Root domain under which tenant subdomains are served, e.g. "example.com"
   * routes acme.example.com to the tenant whose subdomain is "acme". Empty
   * disables host-based tenant routing entirely, which is the safe default:
   * without a configured root, no host can be mistaken for a tenant.
   */
  TENANT_ROOT_DOMAIN: z.string().trim().toLowerCase().default(""),
  /**
   * Directory that uploaded avatars are written to, relative to the working
   * directory. It sits under `public/` so Next serves the files directly.
   *
   * This is local-disk storage: it suits a single server and does not survive
   * a container rebuild or spread across instances. Moving to object storage
   * should mean replacing `avatar-storage.ts` and nothing else.
   */
  AVATAR_UPLOAD_DIR: z.string().trim().default("public/uploads/avatars"),
  /** URL prefix the directory above is served under. */
  AVATAR_URL_BASE: z.string().trim().default("/uploads/avatars"),
  /**
   * SMTP server for outgoing mail.
   *
   * Empty turns sending off altogether: messages are rendered and logged but
   * never delivered. That is the right default for CI and for a checkout that
   * has configured nothing, because the alternative — a hostname that happens
   * to resolve — is how a test run emails a real person.
   *
   * Locally this points at a catcher such as Papercut, MailHog or Mailpit,
   * which accepts every message and delivers none of them.
   */
  SMTP_HOST: z.string().trim().default(""),
  /** Papercut listens on 25; MailHog and Mailpit both use 1025. */
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(25),
  /** TLS from the first byte, as port 465 expects. Local catchers want it off. */
  SMTP_SECURE: z.stringbool().default(false),
  /** Both empty against a local catcher, which authenticates nobody. */
  SMTP_USER: z.string().trim().default(""),
  SMTP_PASSWORD: z.string().default(""),
  /** Envelope sender. A domain we control in production, anything locally. */
  EMAIL_FROM: z.string().trim().default("Ordivex <no-reply@ordivex.local>"),
  /**
   * Where the back office hears about a new application. A shared review inbox
   * rather than a person, so nothing is missed while someone is on leave.
   */
  EMAIL_REVIEW_INBOX: z
    .string()
    .trim()
    .toLowerCase()
    .default("registrations@ordivex.local"),
  /**
   * The one Meta app this platform is registered as a Tech Provider with.
   *
   * There is exactly one app id, one app secret and one verify token for every
   * tenant. A tenant is connected by subscribing this app to their WABA, not
   * by giving them a webhook of their own.
   *
   * All three default to empty rather than being required, so a checkout with
   * no Meta app still boots: the webhook answers 503 on the GET handshake and
   * records deliveries as unverified rather than crashing at import time.
   * Nothing here may ever reach the browser.
   */
  META_APP_ID: z.string().trim().default(""),
  META_APP_SECRET: z.string().trim().default(""),
  META_WEBHOOK_VERIFY_TOKEN: z.string().trim().default(""),
  /** The Embedded Signup configuration id. Public by design, unlike the rest. */
  META_CONFIG_ID: z.string().trim().default(""),
  /** Graph API version, e.g. v21.0. */
  META_GRAPH_VERSION: z.string().trim().default("v21.0"),
});

export const env = serverEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  TENANT_ROOT_DOMAIN: process.env.TENANT_ROOT_DOMAIN,
  AVATAR_UPLOAD_DIR: process.env.AVATAR_UPLOAD_DIR,
  AVATAR_URL_BASE: process.env.AVATAR_URL_BASE,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_REVIEW_INBOX: process.env.EMAIL_REVIEW_INBOX,
  META_APP_ID: process.env.META_APP_ID,
  META_APP_SECRET: process.env.META_APP_SECRET,
  META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN,
  META_CONFIG_ID: process.env.META_CONFIG_ID,
  META_GRAPH_VERSION: process.env.META_GRAPH_VERSION,
});
