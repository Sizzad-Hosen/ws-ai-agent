import { describe, expect, it } from "vitest";

import { choose, detectLanguage, normalize, toAsciiDigits } from "./language";

/**
 * Language detection decides which of three replies a shopper gets, so these
 * are the cases that would embarrass the shop: a Bangla question answered in
 * English, or a plain English sentence answered in Banglish because it happened
 * to contain a word the lexicon claims.
 */
describe("detectLanguage", () => {
  it("reads Bangla script as Bangla", () => {
    expect(detectLanguage("আইফোনের দাম কত?")).toBe("bangla");
    expect(detectLanguage("স্টকে আছে?")).toBe("bangla");
  });

  it("reads romanised Bangla as Banglish", () => {
    expect(detectLanguage("iphone er dam koto")).toBe("banglish");
    expect(detectLanguage("vai stock ase?")).toBe("banglish");
  });

  it("reads English as English", () => {
    expect(detectLanguage("How much is the iPhone 15?")).toBe("english");
    expect(detectLanguage("do you deliver on friday")).toBe("english");
  });

  it("does not mistake English for Banglish on a shared substring", () => {
    // "ki" is a Banglish marker, but only as a whole word — "kitchen" and
    // "asking" contain it and are plainly English.
    expect(detectLanguage("do you sell kitchen items")).toBe("english");
    expect(detectLanguage("asking about a phone case")).toBe("english");
  });

  it("has no opinion about a bare number", () => {
    expect(detectLanguage("2")).toBe("unknown");
    expect(detectLanguage("01712345678")).toBe("unknown");
  });
});

describe("toAsciiDigits", () => {
  it("converts Bangla digits so quantities parse", () => {
    expect(toAsciiDigits("২টি")).toBe("2টি");
    expect(toAsciiDigits("০১৭১২৩৪৫৬৭৮")).toBe("01712345678");
  });
});

describe("normalize", () => {
  it("collapses case and whitespace", () => {
    expect(normalize("  Koto   DAM  ")).toBe("koto dam");
  });
});

describe("choose", () => {
  it("answers in the language asked", () => {
    expect(choose("bangla", "en", "bn", "bl")).toBe("bn");
    expect(choose("banglish", "en", "bn", "bl")).toBe("bl");
    expect(choose("english", "en", "bn", "bl")).toBe("en");
  });

  it("falls back to English for Banglish rather than to Bangla script", () => {
    // Someone writing Latin letters is reading Latin letters.
    expect(choose("banglish", "en", "bn")).toBe("en");
    expect(choose("unknown", "en", "bn", "bl")).toBe("en");
  });
});
