import { describe, expect, it } from "vitest";

import {
  extractPhone,
  extractQuantity,
  isCancellation,
  isCatalogueQuery,
  isConfirmation,
  isDeliveryQuestion,
} from "./parse";

/**
 * These four functions are the only things standing between a chat message and
 * a real order, so the cases below are the ones that would cost a shop money:
 * a quantity read out of a phone number, a phone number read out of an order
 * total, or a confirmation inferred from a shopper thinking out loud.
 */
describe("extractQuantity", () => {
  it("reads a bare number", () => {
    expect(extractQuantity("2")).toBe(2);
    expect(extractQuantity(" 12 ")).toBe(12);
  });

  it("reads a counted quantity in either script", () => {
    expect(extractQuantity("3 ta nibo")).toBe(3);
    expect(extractQuantity("২টি লাগবে")).toBe(2);
    expect(extractQuantity("qty: 5")).toBe(5);
  });

  it("reads spelled-out quantities", () => {
    expect(extractQuantity("ekta nibo")).toBe(1);
    expect(extractQuantity("I want two")).toBe(2);
  });

  it("refuses zero and nonsense", () => {
    expect(extractQuantity("0")).toBeNull();
    expect(extractQuantity("koto dam?")).toBeNull();
  });

  it("does not read a quantity out of a phone number", () => {
    expect(extractQuantity("01712345678")).toBeNull();
  });
});

describe("extractPhone", () => {
  it("normalises Bangladesh mobile numbers to +88", () => {
    expect(extractPhone("01712345678")).toBe("+8801712345678");
    expect(extractPhone("+8801812345678")).toBe("+8801812345678");
    expect(extractPhone("8801912345678")).toBe("+8801912345678");
  });

  it("copes with the way people actually type numbers", () => {
    expect(extractPhone("amar number 017-1234-5678")).toBe("+8801712345678");
    expect(extractPhone("০১৭১২৩৪৫৬৭৮")).toBe("+8801712345678");
  });

  it("accepts a customer abroad, in explicit international form", () => {
    expect(extractPhone("+971501234567")).toBe("+971501234567");
    expect(extractPhone("call me on +44 7700 900123")).toBe("+447700900123");
  });

  it("rejects anything that is not one", () => {
    // Bare digits that are not a Bangladesh mobile stay refused: an order
    // number, a postcode and a house number are all bare digits, and a
    // delivery sent to a postcode does not arrive.
    expect(extractPhone("1234")).toBeNull();
    expect(extractPhone("02123456789")).toBeNull();
    expect(extractPhone("1200")).toBeNull();
    expect(extractPhone("no number here")).toBeNull();
  });
});

describe("isConfirmation", () => {
  it("accepts only an explicit confirmation", () => {
    expect(isConfirmation("CONFIRM ORDER")).toBe(true);
    expect(isConfirmation(" confirm order ")).toBe(true);
    expect(isConfirmation("অর্ডার কনফার্ম")).toBe(true);
  });

  it("does not treat a shopper thinking aloud as a confirmation", () => {
    expect(isConfirmation("should I confirm order now?")).toBe(false);
    expect(isConfirmation("ok")).toBe(false);
    expect(isConfirmation("yes")).toBe(false);
  });
});

describe("isCancellation", () => {
  it("recognises a cancellation", () => {
    expect(isCancellation("cancel")).toBe(true);
    expect(isCancellation("CANCEL ORDER")).toBe(true);
    expect(isCancellation("অর্ডার বাতিল")).toBe(true);
  });

  it("leaves ordinary sentences alone", () => {
    expect(isCancellation("can I cancel later?")).toBe(false);
  });
});

describe("isCatalogueQuery", () => {
  it("recognises 'what do you sell' in all three languages", () => {
    expect(isCatalogueQuery("what products do you have?")).toBe(true);
    expect(isCatalogueQuery("ki ki product ache")).toBe(true);
    expect(isCatalogueQuery("আপনাদের কি কি পণ্য আছে?")).toBe(true);
  });

  it("recognises the bare Bangla form, with no word for 'product'", () => {
    // How the question is actually typed. The earlier pattern wanted a noun
    // nobody uses, so this fell through to the product search — and, mid
    // checkout, into the phone-number parser.
    expect(isCatalogueQuery("কী কী আছে?")).toBe(true);
    expect(isCatalogueQuery("কি কি আছে")).toBe(true);
    expect(isCatalogueQuery("ki ki ache")).toBe(true);
  });

  it("does not swallow a specific product question", () => {
    expect(isCatalogueQuery("iphone 15 er dam koto")).toBe(false);
    expect(isCatalogueQuery("is the blue one in stock")).toBe(false);
  });
});

describe("isDeliveryQuestion", () => {
  it("recognises the question in all three languages", () => {
    expect(isDeliveryQuestion("Delivery charge?")).toBe(true);
    expect(isDeliveryQuestion("how much is delivery")).toBe(true);
    expect(isDeliveryQuestion("delivery charge koto?")).toBe(true);
    expect(isDeliveryQuestion("delivery khoroch koto")).toBe(true);
    expect(isDeliveryQuestion("ডেলিভারি চার্জ কত?")).toBe(true);
    expect(isDeliveryQuestion("কুরিয়ার খরচ কত")).toBe(true);
  });

  it("leaves questions about timing and reach to the FAQ", () => {
    // How long and where are questions the shop answers in its own words.
    // Only the charge is settled by its settings, and answering the wrong one
    // is worse than searching for an answer.
    expect(isDeliveryQuestion("when will you deliver")).toBe(false);
    expect(isDeliveryQuestion("delivery koto din lage?")).toBe(false);
    expect(isDeliveryQuestion("ডেলিভারি কত দিন লাগে?")).toBe(false);
    expect(isDeliveryQuestion("how long does delivery take")).toBe(false);
    expect(isDeliveryQuestion("do you deliver to Sylhet")).toBe(false);
    expect(isDeliveryQuestion("koto dam")).toBe(false);
  });
});
