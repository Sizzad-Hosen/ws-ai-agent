import { describe, expect, it } from "vitest";

import { derivePlanCode, planFormSchema, toPlanValues } from "./schemas";

const VALID = {
  name: "Growth",
  description: "For scaling teams.",
  monthlyPrice: "49.00",
  annualPrice: "470.00",
  currency: "usd",
  highlights: "One\nTwo",
  accentColor: "#10b981",
  isActive: true,
} as const;

describe("planFormSchema", () => {
  it("accepts a well-formed plan", () => {
    expect(planFormSchema.safeParse(VALID).success).toBe(true);
  });

  describe("money", () => {
    it("rejects a number, so precision is never lost to a float", () => {
      const result = planFormSchema.safeParse({ ...VALID, monthlyPrice: 49 });
      expect(result.success).toBe(false);
    });

    it("rejects more than two decimals", () => {
      expect(
        planFormSchema.safeParse({ ...VALID, monthlyPrice: "49.999" }).success,
      ).toBe(false);
    });

    it("rejects a negative amount", () => {
      expect(
        planFormSchema.safeParse({ ...VALID, monthlyPrice: "-1.00" }).success,
      ).toBe(false);
    });

    it("treats a blank price as a negotiated tier, not as zero", () => {
      const parsed = planFormSchema.safeParse({
        ...VALID,
        monthlyPrice: "",
        annualPrice: "",
      });
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        const values = toPlanValues(parsed.data);
        expect(values.monthlyPrice).toBeNull();
        expect(values.annualPrice).toBeNull();
      }
    });
  });

  describe("annual price ceiling", () => {
    it("rejects an annual price above twelve months", () => {
      // The annual option advertises a saving; it must not cost more.
      expect(
        planFormSchema.safeParse({
          ...VALID,
          monthlyPrice: "10.00",
          annualPrice: "500.00",
        }).success,
      ).toBe(false);
    });

    it("accepts exactly twelve months", () => {
      expect(
        planFormSchema.safeParse({
          ...VALID,
          monthlyPrice: "10.00",
          annualPrice: "120.00",
        }).success,
      ).toBe(true);
    });

    it("skips the rule when either price is negotiated", () => {
      expect(
        planFormSchema.safeParse({
          ...VALID,
          monthlyPrice: "",
          annualPrice: "9999.00",
        }).success,
      ).toBe(true);
    });
  });

  describe("currency", () => {
    it("rejects anything that is not a three-letter code", () => {
      for (const currency of ["DOLLAR", "US", "", "US1"]) {
        expect(planFormSchema.safeParse({ ...VALID, currency }).success).toBe(
          false,
        );
      }
    });

    it("normalises to upper case rather than assuming a currency", () => {
      const parsed = planFormSchema.parse({ ...VALID, currency: "eur" });
      expect(toPlanValues(parsed).currency).toBe("EUR");
    });
  });
});

describe("toPlanValues", () => {
  it("splits highlights on newlines and drops blank lines", () => {
    const parsed = planFormSchema.parse({
      ...VALID,
      highlights: "One\n\n  Two  \n",
    });
    expect(toPlanValues(parsed).features.highlights).toEqual(["One", "Two"]);
  });

  it("carries existing feature toggles through untouched", () => {
    // The form does not edit toggles, so saving must not silently clear them.
    const toggles = [{ key: "kb", label: "Knowledge Base", enabled: true }];
    const parsed = planFormSchema.parse(VALID);
    expect(toPlanValues(parsed, toggles).features.toggles).toEqual(toggles);
  });

  it("stores an empty description as null rather than an empty string", () => {
    const parsed = planFormSchema.parse({ ...VALID, description: "" });
    expect(toPlanValues(parsed).description).toBeNull();
  });
});

describe("derivePlanCode", () => {
  it("slugifies a name", () => {
    expect(derivePlanCode("Growth Plan")).toBe("growth-plan");
    expect(derivePlanCode("  Pro / Enterprise!  ")).toBe("pro-enterprise");
  });

  it("stays inside the 100-character column", () => {
    expect(derivePlanCode("a".repeat(200)).length).toBeLessThanOrEqual(100);
  });
});
