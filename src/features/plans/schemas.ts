import { z } from "zod";

import type { PlanFeatures } from "@/features/plans/types";

/**
 * Write-side validation for the plan catalogue (screens 06 and 07).
 *
 * The schema validates the raw string fields a form actually submits and does
 * not transform them, so the same schema types the client resolver and the
 * server action. Normalisation into the stored shape is a separate, explicit
 * step (`toPlanValues`).
 *
 * An empty price is not zero — it encodes a negotiated "Custom" tier as `null`.
 */

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

const moneyField = z
  .string()
  .trim()
  .refine((value) => value === "" || MONEY_PATTERN.test(value), {
    message:
      "Enter an amount with up to two decimals, or leave blank for Custom.",
  });

export const planFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Plan name must be at least 2 characters.")
      .max(120, "Plan name must be 120 characters or fewer."),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be 2000 characters or fewer."),
    monthlyPrice: moneyField,
    annualPrice: moneyField,
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, "Use a three-letter ISO 4217 currency code."),
    highlights: z.string().max(4000),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Pick one of the offered swatches."),
    isActive: z.boolean(),
  })
  .refine(
    (value) =>
      value.monthlyPrice === "" ||
      value.annualPrice === "" ||
      Number(value.annualPrice) <= Number(value.monthlyPrice) * 12,
    {
      // The annual field advertises a saving, so it must not exceed 12 months.
      message: "Annual price must not exceed twelve times the monthly price.",
      path: ["annualPrice"],
    },
  );

export type PlanFormValues = z.infer<typeof planFormSchema>;

export interface NormalisedPlan {
  readonly name: string;
  readonly description: string | null;
  readonly monthlyPrice: string | null;
  readonly annualPrice: string | null;
  readonly currency: string;
  readonly features: PlanFeatures;
  readonly isActive: boolean;
}

/** Turns validated form strings into the shape stored in `plans`. */
export function toPlanValues(
  values: PlanFormValues,
  existingToggles: readonly PlanFeatures["toggles"][number][] = [],
): NormalisedPlan {
  return {
    name: values.name,
    description: values.description === "" ? null : values.description,
    monthlyPrice: values.monthlyPrice === "" ? null : values.monthlyPrice,
    annualPrice: values.annualPrice === "" ? null : values.annualPrice,
    currency: values.currency.toUpperCase(),
    isActive: values.isActive,
    features: {
      version: 1,
      toggles: existingToggles,
      highlights: values.highlights
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      accentColor: values.accentColor,
    },
  };
}

/**
 * `code` is unique and user-facing. It is derived once on creation and then
 * immutable, so URLs and integrations never break under a rename (D-21).
 */
export function derivePlanCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
