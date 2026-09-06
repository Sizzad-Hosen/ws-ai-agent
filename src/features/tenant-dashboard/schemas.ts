import { z } from "zod";

/** A tenant slug as it appears in the URL. Validated before it reaches a query. */
export const tenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(63)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "That is not a workspace address.",
  );

export const tenantLoginSchema = z.object({
  email: z.email("Enter the email address you sign in with.").trim(),
  password: z.string().min(1, "Enter your password."),
  rememberMe: z.boolean().default(false),
});

export type TenantLoginInput = z.infer<typeof tenantLoginSchema>;
