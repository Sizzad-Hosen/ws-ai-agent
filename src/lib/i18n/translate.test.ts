import { describe, expect, it } from "vitest";

import { MESSAGES } from "@/lib/i18n/messages";
import {
  DEFAULT_LOCALE,
  LOCALES,
  resolveLocale,
  translate,
  translatorFor,
} from "@/lib/i18n/translate";

describe("resolveLocale", () => {
  it("falls back when the column is empty", () => {
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("")).toBe(DEFAULT_LOCALE);
  });

  it("accepts a region tag and matches on the language", () => {
    expect(resolveLocale("bn-BD")).toBe("bn");
    expect(resolveLocale("bn_BD")).toBe("bn");
    expect(resolveLocale("EN-GB")).toBe("en");
  });

  it("falls back rather than throwing on an unknown value", () => {
    // A bad value in one column must not be able to take a workspace down.
    expect(resolveLocale("klingon")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("  ")).toBe(DEFAULT_LOCALE);
  });
});

describe("translate", () => {
  it("returns the message for the locale", () => {
    expect(translate("en", "common.next")).toBe("Next");
    expect(translate("bn", "common.next")).not.toBe("Next");
  });

  it("fills placeholders", () => {
    expect(translate("en", "wizard.progress", { current: 3, total: 5 })).toBe(
      "Step 3 of 5",
    );
  });

  it("leaves an unfilled placeholder visible", () => {
    // Visible is how it gets noticed. An empty gap in a sentence a shop owner
    // is following is worse than a stray {total}.
    expect(translate("en", "wizard.progress", { current: 3 })).toContain(
      "{total}",
    );
  });

  it("binds a locale", () => {
    const t = translatorFor("bn");

    expect(t.locale).toBe("bn");
    expect(t("common.copy")).toBe(MESSAGES.bn["common.copy"]);
  });
});

describe("the message tables", () => {
  it("carry the same keys in both languages", () => {
    // The types already guarantee this. Asserted anyway, because the types
    // guarantee it only while `bn` keeps its annotation, and an `as const`
    // added there in a hurry would remove the guarantee silently.
    expect(Object.keys(MESSAGES.bn).sort()).toEqual(
      Object.keys(MESSAGES.en).sort(),
    );
  });

  it("leaves nothing untranslated", () => {
    const untranslated = Object.keys(MESSAGES.en).filter((key) => {
      const english = MESSAGES.en[key as keyof typeof MESSAGES.en];
      const bangla = MESSAGES.bn[key as keyof typeof MESSAGES.bn];

      // Meta's own field labels stay in English on purpose: the tenant is
      // looking for that exact text on Meta's screen.
      const isMetaLabel =
        /^(Phone number ID|WhatsApp Business Account ID|Callback URL|Verify token)$/.test(
          english,
        );

      return !isMetaLabel && english === bangla;
    });

    expect(untranslated).toEqual([]);
  });

  it("covers every locale the application offers", () => {
    expect(Object.keys(MESSAGES).sort()).toEqual([...LOCALES].sort());
  });
});
