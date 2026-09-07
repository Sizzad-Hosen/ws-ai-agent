import { z } from "zod";

/**
 * Slugs, shared by categories and products.
 *
 * Both address a row in a URL, so both constrain the shape rather than accept
 * free text; only the length limit differs, which is why this is a factory.
 */
export function slugSchema(maxLength: number) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a slug.")
    .max(maxLength)
    .regex(
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
      "Use lowercase letters, numbers and hyphens.",
    );
}

/**
 * Derives a slug from a name, so the common case needs no typing.
 *
 * Diacritics are folded rather than stripped, so "Café" becomes "cafe" instead
 * of losing the letter entirely.
 */
export function slugify(value: string, maxLength = 180): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");
}
