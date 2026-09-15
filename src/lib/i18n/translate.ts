import { MESSAGES, type MessageKey } from "@/lib/i18n/messages";

/**
 * Locale resolution and one substitution rule. Nothing else.
 *
 * Pure and dependency-free, so it runs in a Server Component, in a Client
 * Component and in a unit test without ceremony. Both message tables are small
 * and both ship to the browser wherever a client component translates — which
 * is the trade for having no runtime, no loader and no async boundary.
 */

export const LOCALES = ["en", "bn"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * English, not Bangla.
 *
 * `tenants.default_locale` is nullable and unset on every row today, so the
 * fallback is what nearly every workspace will actually see until an owner
 * chooses. Meta's own screens — the ones every wizard step tells the tenant to
 * click through — are in English, and instructions that name a button should
 * name it in the language the button is written in.
 */
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Turns whatever is on the tenant row into a locale this application has.
 *
 * Accepts a region tag — `bn-BD` is the form a browser sends and a plausible
 * thing for an administrator to type — and matches on the language part.
 * Anything unrecognised falls back rather than throwing: a bad value in one
 * column must not be able to take a workspace down.
 */
export function resolveLocale(raw: string | null | undefined): Locale {
  if (!raw) return DEFAULT_LOCALE;

  const language = raw.trim().toLowerCase().split(/[-_]/)[0];

  return isLocale(language) ? language : DEFAULT_LOCALE;
}

export type MessageVars = Readonly<Record<string, string | number>>;

/**
 * Looks a message up and fills its placeholders.
 *
 * `{name}` is replaced by `vars.name`. A placeholder with no matching variable
 * is left as written — visible in the sentence, which is how it gets noticed
 * and fixed, rather than silently becoming an empty gap in a sentence a shop
 * owner is trying to follow.
 *
 * There is no missing-key branch. `MessageKey` is derived from the English
 * table, and the Bangla table is typed as a total record of it, so both halves
 * are guaranteed present at compile time.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: MessageVars,
): string {
  const message = MESSAGES[locale][key];

  if (!vars) return message;

  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = vars[name];
    return value === undefined ? placeholder : String(value);
  });
}

export interface Translator {
  readonly locale: Locale;
  (key: MessageKey, vars?: MessageVars): string;
}

/**
 * Binds a locale once, so a component reads `t("wizard.title")`.
 *
 * The locale is carried on the function because a component that needs to pass
 * the language on — to a date formatter, or to a client child — should not
 * have to be handed it separately and risk the two disagreeing.
 */
export function translatorFor(locale: Locale): Translator {
  const t = ((key: MessageKey, vars?: MessageVars) =>
    translate(locale, key, vars)) as Translator;

  return Object.assign(t, { locale });
}
