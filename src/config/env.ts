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
});

export const env = serverEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  TENANT_ROOT_DOMAIN: process.env.TENANT_ROOT_DOMAIN,
});
