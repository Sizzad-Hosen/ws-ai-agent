import { z } from "zod";

import { listQuerySchema } from "@/features/tenant-dashboard/query";
import { CUSTOMER_STATUSES } from "@/features/tenant-dashboard/status";

/** Blank contact fields are absent, not empty strings, so lookups stay clean. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : value));

const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+0-9 ()-]*$/, "Use digits, spaces, brackets, dashes or a leading +")
  .optional()
  .transform((value) => (value === undefined || value === "" ? null : value));

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(150),
  /**
   * Email is optional and deliberately not unique: the schema indexes it
   * without a unique constraint, because a WhatsApp contact may become a
   * customer with no email at all, and two family members can share one.
   */
  email: z
    .union([z.literal(""), z.email("Enter a valid email address.")])
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : value)),
  phone: phoneSchema,
  status: z.enum(CUSTOMER_STATUSES).default("ACTIVE"),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

export const addressInputSchema = z.object({
  label: optionalText(50),
  recipientName: z.string().trim().min(1, "Enter who receives it.").max(150),
  phone: z
    .string()
    .trim()
    .min(1, "Enter a phone number.")
    .max(30)
    .regex(
      /^[+0-9 ()-]+$/,
      "Use digits, spaces, brackets, dashes or a leading +",
    ),
  addressLine: z.string().trim().min(1, "Enter the address.").max(500),
  city: z.string().trim().min(1, "Enter a city.").max(100),
  region: optionalText(100),
  postalCode: optionalText(30),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressInputSchema>;

/** Unknown filter values are dropped, so a stale bookmark still lists. */
export const customerListQuerySchema = listQuerySchema.extend({
  status: z.enum(CUSTOMER_STATUSES).optional().catch(undefined),
});

export type CustomerListQueryInput = z.infer<typeof customerListQuerySchema>;
