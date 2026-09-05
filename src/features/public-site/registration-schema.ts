import { z } from "zod";

/**
 * Public sign-up, validated against the shape of `tenant_registrations`.
 *
 * Field lengths mirror the column widths so a submission cannot be accepted by
 * the form and then rejected by the database.
 */
export const registrationFormSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Enter your business name.")
    .max(180, "Business name must be 180 characters or fewer."),
  ownerName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(120, "Name must be 120 characters or fewer."),
  ownerEmail: z
    .email("Enter a valid email address.")
    .max(190, "Email must be 190 characters or fewer."),
  ownerPhone: z
    .string()
    .trim()
    .min(6, "Enter the WhatsApp number you sell from.")
    .max(30, "Phone number must be 30 characters or fewer.")
    .regex(
      /^[+0-9 ()-]+$/,
      "Use digits, spaces and the + ( ) - characters only.",
    ),
  industry: z
    .string()
    .trim()
    .min(2, "Choose the closest industry.")
    .max(100, "Industry must be 100 characters or fewer."),
  region: z
    .string()
    .trim()
    .min(2, "Choose your primary region.")
    .max(80, "Region must be 80 characters or fewer."),
});

export type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

export const REGISTRATION_INDUSTRIES = [
  "Fashion & Apparel",
  "Electronics",
  "Cosmetics & Beauty",
  "Books & Media",
  "Grocery & Retail",
  "Healthcare & Pharma",
  "Other",
] as const;

export const REGISTRATION_REGIONS = [
  "North America",
  "Latin America",
  "Europe",
  "Middle East & Africa",
  "South Asia",
  "Asia Pacific",
] as const;
