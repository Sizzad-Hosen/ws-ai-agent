const DEFAULT_LOCALE = "en-US";

export function formatNumber(value: number, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** 1_240 → "1.2k", 1_200_000 → "1.2M". Used for dense KPI tiles. */
export function formatCompact(value: number, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Money arrives from the domain as a decimal string so no precision is lost in
 * transit. `null` renders as the caller's placeholder (plans priced "Custom").
 */
export function formatMoney(
  amount: string | number | null,
  currency: string,
  options: { readonly compact?: boolean; readonly locale?: string } = {},
): string | null {
  if (amount === null) {
    return null;
  }

  const numeric = typeof amount === "string" ? Number(amount) : amount;

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
    style: "currency",
    currency,
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits: options.compact ? 1 : numeric % 1 === 0 ? 0 : 2,
  }).format(numeric);
}

export function formatPercent(
  value: number,
  fractionDigits = 0,
  locale = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

export function formatDate(iso: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** Renders an absent date as an em dash rather than an epoch. */
export function formatOptionalDate(
  iso: string | null,
  locale = DEFAULT_LOCALE,
): string {
  return iso === null ? "—" : formatDate(iso, locale);
}

/** Millisecond-precision stamp used by the message monitoring table. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number, length = 2) =>
    String(value).padStart(length, "0");

  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.` +
    pad(date.getUTCMilliseconds(), 3)
  );
}

export function formatClockTime(iso: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

const RELATIVE_UNITS: readonly (readonly [
  Intl.RelativeTimeFormatUnit,
  number,
])[] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
  ["second", 1000],
];

/**
 * Relative timestamps are derived from a fixed `now` supplied by the caller so
 * server and client render the same string (no hydration drift).
 */
export function formatRelativeTime(
  iso: string,
  now: Date,
  locale = DEFAULT_LOCALE,
): string {
  const deltaMs = new Date(iso).getTime() - now.getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(deltaMs) >= unitMs) {
      return formatter.format(Math.round(deltaMs / unitMs), unit);
    }
  }

  return "just now";
}

export function formatLatency(milliseconds: number | null): string {
  return milliseconds === null ? "–" : `${formatNumber(milliseconds)}ms`;
}

/** Screen 05 renders an absent numeric limit as "Unlimited". */
export function formatLimit(value: number | null): string {
  return value === null ? "Unlimited" : formatNumber(value);
}
