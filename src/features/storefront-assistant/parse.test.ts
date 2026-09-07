import { describe, expect, it } from "vitest";

import {
  extractPhone,
  extractQuantity,
  isCancellation,
  isCatalogueQuery,
  isConfirmation,
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

  it("rejects anything that is not one", () => {
    expect(extractPhone("1234")).toBeNull();
    expect(extractPhone("02123456789")).toBeNull();
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

  it("does not swallow a specific product question", () => {
    expect(isCatalogueQuery("iphone 15 er dam koto")).toBe(false);
    expect(isCatalogueQuery("is the blue one in stock")).toBe(false);
  });
});
