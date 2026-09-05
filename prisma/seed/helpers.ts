export function requiredSeedValue(
  name: "BO_SEED_ADMIN_EMAIL" | "BO_SEED_ADMIN_PASSWORD",
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required to seed the development database.`);
  }

  return value;
}

/** Seed timestamps are relative so the data never looks stale. */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function daysAhead(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
