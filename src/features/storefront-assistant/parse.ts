import { normalize, toAsciiDigits } from "./language";

/**
 * Deterministic extraction of the few values the checkout needs.
 *
 * Ported from the reference agent's `_extract_quantity` and `_extract_phone`.
 * These are parsed rather than asked of the model on purpose: a quantity and a
 * phone number are facts the customer typed, and a model that "helpfully"
 * corrects a digit would ship an order to the wrong person.
 */

const WORD_QUANTITIES: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  ekta: 1,
  duita: 2,
  duto: 2,
  tinta: 3,
  charta: 4,
  pachta: 5,
};

export function extractQuantity(message: string): number | null {
  const text = normalize(message);

  const patterns = [
    /^(\d{1,3})$/,
    /(?:quantity|qty|koyti|koyta|piece|pieces)\s*[:=-]?\s*(\d{1,3})\b/,
    // The trailing boundary is a Unicode lookahead, not `\b`: `\b` is
    // ASCII-only, so it never matched after "টি" and "২টি" parsed as nothing.
    /(\d{1,3})\s*(?:ta|ti|টি|টা|copy|copies|pcs?|pieces?)(?![\p{L}\p{N}])/u,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);

    if (match) {
      const value = Number(match[1]);
      if (value > 0) return value;
    }
  }

  for (const word of text.split(" ")) {
    const value = WORD_QUANTITIES[word];
    if (value) return value;
  }

  return null;
}

/**
 * A phone number the shop can call, normalised.
 *
 * A Bangladesh mobile is recognised first and normalised to +88, because that
 * is what almost every number typed into these shops is and because the local
 * form ("01712345678") carries no country code to infer one from.
 *
 * Anything else is accepted only in explicit international form — a leading
 * "+" and 8 to 15 digits. That deliberately refuses a bare string of digits
 * that is not a Bangladesh mobile: an order number, a postcode and a house
 * number are all bare digits, and a delivery sent to a postcode is a delivery
 * that does not arrive. It does not refuse the customer abroad, which the
 * Bangladesh-only version did.
 */
export function extractPhone(message: string): string | null {
  const compact = toAsciiDigits(message).replace(/[\s()-]/g, "");
  const bangladesh = /(?:\+?88)?01[3-9]\d{8}/.exec(compact);

  if (bangladesh) {
    const number = bangladesh[0];

    if (number.startsWith("01")) return `+88${number}`;
    if (number.startsWith("8801")) return `+${number}`;

    return number;
  }

  const international = /\+\d{8,15}/.exec(compact);

  return international ? international[0] : null;
}

/** The one phrase that turns a summary into an order, in all three languages. */
const CONFIRM_PHRASES = new Set([
  "confirm order",
  "confirm",
  "order confirm",
  "অর্ডার কনফার্ম",
  "কনফার্ম",
  "confirm kori",
  "confirm korun",
]);

export function isConfirmation(message: string): boolean {
  return CONFIRM_PHRASES.has(normalize(message));
}

const CANCEL_PHRASES = new Set([
  "cancel",
  "cancel order",
  "order cancel",
  "বাতিল",
  "অর্ডার বাতিল",
  "cancel korun",
  "baad din",
]);

export function isCancellation(message: string): boolean {
  return CANCEL_PHRASES.has(normalize(message));
}

/**
 * "How much is delivery?" — the most asked question in the shop, and one the
 * shop already answered in its settings, so it never needs a search.
 */
export function isDeliveryQuestion(message: string): boolean {
  const text = normalize(message);

  const aboutDelivery =
    /\b(delivery|shipping|deliver|courier)\b/.test(text) ||
    /(ডেলিভারি|ডেলিভারী|কুরিয়ার)/.test(text);

  if (!aboutDelivery) return false;

  // "delivery koto din lage" asks how long, not how much. Time is a question
  // the shop answers in its own FAQ; only the charge comes from settings, and
  // answering the wrong one is worse than searching.
  const aboutTime =
    /\b(day|days|time|long|when|din|dine|somoy|kobe|kotodin)\b/.test(text) ||
    /(দিন|সময়|কবে|কতদিন)/.test(text);

  if (aboutTime) return false;

  return (
    /\b(charge|charges|cost|fee|price|free|taka|khoroch|koto)\b/.test(text) ||
    /how much/.test(text) ||
    /(চার্জ|খরচ|কত|ফ্রি|টাকা|মূল্য)/.test(text)
  );
}

/** "What do you sell?" — asked often enough to answer without a search. */
export function isCatalogueQuery(message: string): boolean {
  const text = normalize(message);

  const english =
    /\b(products?|items?|catalogue|catalog|sell)\b/.test(text) &&
    /\b(what|which|show|list|all|have|available|any)\b/.test(text);
  const banglish =
    /(ki product|product ki|ki ki product|product dekhao|ki ki ache|ki ki ase)/.test(
      text,
    );
  const bangla =
    /(পণ্য|প্রোডাক্ট|আইটেম)/.test(text) &&
    /(কি|কী|কোন|আছে|দেখান|দেখাও)/.test(text);
  // "কী কী আছে?" — a repeated interrogative and "আছে", with no noun at all.
  // The commonest way the question is actually asked, and the earlier pattern
  // wanted a word for "product" that nobody types.
  const banglaBare = /(কি|কী)\s+(কি|কী)\s*(আছে|ache|ase)/.test(text);

  return english || banglish || bangla || banglaBare;
}
