import { z } from "zod";

/**
 * Money, as decimal strings.
 *
 * Amounts cross three boundaries — form, Server Action, Postgres `numeric` —
 * and a float would lose precision at the first. They stay strings end to end,
 * and arithmetic happens in whole cents so a sum of prices cannot drift.
 */

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

export const moneySchema = z
  .string()
  .trim()
  .regex(MONEY_PATTERN, "Enter an amount like 19.99");

/** An empty field is an absent amount, not a zero one. */
export const optionalMoneySchema = z
  .union([z.literal(""), moneySchema])
  .nullish()
  .transform((value) =>
    value === "" || value === null || value === undefined ? null : value,
  );

/** Cents, so totals are integer arithmetic. Rounds half away from zero. */
export function toCents(amount: string | number): number {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

/**
 * A decimal from the database, as a canonical two-place string.
 *
 * Postgres `numeric` comes back through Prisma with its trailing zeros
 * trimmed — 18.00 arrives as "18" — which puts "4.5" in a price field and
 * makes two equal amounts compare unequal as strings. Normalising once here
 * keeps every screen and every comparison on the same shape.
 */
export function toAmount(value: { toString(): string }): string {
  return fromCents(toCents(value.toString()));
}
