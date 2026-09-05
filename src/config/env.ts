import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  /**
   * Template for a tenant's public site, e.g.
   * `https://{tenantCode}.sellpilot.ai`. The master schema stores no site URL
   * (D-35), so the "View tenant site" action is disabled unless this is set.
   */
  TENANT_SITE_URL_TEMPLATE: z
    .string()
    .trim()
    .min(1)
    .optional(),
});

export const env = serverEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  TENANT_SITE_URL_TEMPLATE: process.env.TENANT_SITE_URL_TEMPLATE,
});
