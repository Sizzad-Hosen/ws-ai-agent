/**
 * Slugs for catalogue rows.
 *
 * `categories.slug` and `products.slug` are both unique and both reach a URL,
 * so they must be derivable from a name and stable once set. This is the same
 * shape as `deriveSubdomain` in the registration flow, but the limits differ —
 * a DNS label caps at 63 characters, these columns are varchar(180) and
 * varchar(220) — so the rule is written once here for the catalogue rather than
 * generalised into something that serves neither well.
 */

/** `categories.slug` is varchar(180); `products.slug` is varchar(220). */
export const MAX_CATEGORY_SLUG = 180;
export const MAX_PRODUCT_SLUG = 220;

/**
 * Turns a name into a slug, or null when nothing usable survives.
 *
 * Null rather than a generated placeholder: a product named only in Bangla
 * yields no Latin characters, and inventing "product-1" would produce a URL
 * that means nothing to the person who typed the name. The form asks for a
 * slug in that case instead of guessing.
 */
export function deriveSlug(name: string, maxLength: number): string | null {
  const slug = name
    .normalize("NFKD")
    // Strip diacritics so "Café" becomes "cafe" rather than losing the letter.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");

  return slug === "" ? null : slug;
}

/** True when a slug is already in the shape the column and the URL expect. */
export function isValidSlug(slug: string, maxLength: number): boolean {
  return (
    slug.length > 0 &&
    slug.length <= maxLength &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  );
}

/**
 * Appends a numeric suffix while staying inside the column limit.
 *
 * Used when a derived slug collides with one already taken, which is a
 * routine outcome: two products called "Blue Shirt" is not a mistake.
 */
export function withSuffix(
  slug: string,
  attempt: number,
  maxLength: number,
): string {
  if (attempt <= 1) return slug;

  const suffix = `-${attempt}`;
  const room = maxLength - suffix.length;

  return `${slug.slice(0, room).replace(/-+$/, "")}${suffix}`;
}
