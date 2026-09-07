/**
 * Language handling for the storefront assistant.
 *
 * Ported from the reference agent in `WhatsApp_AI-/src/i18n.py` and its
 * `_detect_language`. Detection is deterministic — script first, then a small
 * Banglish lexicon — rather than asked of the model, because a classification
 * typo would answer a Bangla customer in English, and that is the one mistake
 * a shopper notices immediately.
 */

export const LANGUAGES = ["bangla", "banglish", "english", "unknown"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Bangla script, including the digits, sits in this Unicode block. */
const BANGLA_SCRIPT = /[ঀ-৿]/;

/**
 * Bangla written in Latin letters. Short, common and unambiguous words only:
 * anything that is also an English word would misroute a plain English message.
 */
const BANGLISH_MARKERS = new Set([
  "vai",
  "bhai",
  "ase",
  "ache",
  "koto",
  "dam",
  "chai",
  "korte",
  "nibo",
  "kinbo",
  "kinte",
  "amar",
  "ami",
  "apnar",
  "janaben",
  "koyta",
  "koyti",
  "lagbe",
  "dorkar",
  "dhonnobad",
  "accha",
  "hobe",
  "hoyeche",
  "korbo",
  "ki",
  "kothay",
]);

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Bangla digits are digits: "২টি" has to reach the quantity parser as "2". */
export function toAsciiDigits(value: string): string {
  return value.replace(/[০-৯]/g, (digit) =>
    String(BANGLA_DIGITS.indexOf(digit)),
  );
}

export function normalize(message: string): string {
  return toAsciiDigits(message).toLowerCase().trim().split(/\s+/).join(" ");
}

export function detectLanguage(message: string): Language {
  if (BANGLA_SCRIPT.test(message)) return "bangla";

  const words = new Set(normalize(message).split(" "));

  for (const marker of BANGLISH_MARKERS) {
    if (words.has(marker)) return "banglish";
  }

  return /[a-z]/i.test(message) ? "english" : "unknown";
}

/**
 * Picks the reply for a language.
 *
 * Banglish falls back to English rather than to Bangla script: someone writing
 * "koto dam" is reading Latin letters, and answering in Bangla script is a
 * worse guess than answering in English.
 */
export function choose(
  language: Language,
  english: string,
  bangla: string,
  banglish?: string,
): string {
  if (language === "bangla") return bangla;
  if (language === "banglish") return banglish ?? english;
  return english;
}
