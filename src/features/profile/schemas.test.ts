import { describe, expect, it } from "vitest";

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordChangeSchema,
  profileDetailsSchema,
} from "./schemas";

const VALID_PASSWORD = "Correct-Horse-9";

function change(overrides: Record<string, unknown> = {}) {
  return passwordChangeSchema.safeParse({
    currentPassword: "old-password-1A",
    newPassword: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
    ...overrides,
  });
}

describe("profileDetailsSchema", () => {
  it("accepts a name and email, trimming and lowercasing the address", () => {
    const result = profileDetailsSchema.safeParse({
      name: "  Ada Lovelace  ",
      email: "  Ada@Example.COM ",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "Ada Lovelace",
      // Stored lowercase, so the unique index cannot be defeated by casing:
      // "Ada@..." and "ada@..." must not be two accounts.
      email: "ada@example.com",
    });
  });

  it("rejects a name that is only whitespace", () => {
    expect(
      profileDetailsSchema.safeParse({ name: "   ", email: "a@b.com" }).success,
    ).toBe(false);
  });

  it("rejects a name longer than the column", () => {
    // admin_users.name is varchar(120); a longer value would be a database
    // error rather than a field message.
    const result = profileDetailsSchema.safeParse({
      name: "a".repeat(121),
      email: "a@b.com",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an address that is not an email", () => {
    expect(
      profileDetailsSchema.safeParse({ name: "Ada", email: "ada" }).success,
    ).toBe(false);
  });

  it("refuses a role smuggled alongside the editable fields", () => {
    // The whole reason the schema is strict: this form must never be a
    // self-service route to a higher role.
    const result = profileDetailsSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      role: "super_admin",
    });

    expect(result.success).toBe(false);
  });

  it("refuses a status smuggled alongside the editable fields", () => {
    const result = profileDetailsSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      status: "active",
    });

    expect(result.success).toBe(false);
  });
});

describe("passwordChangeSchema", () => {
  it("accepts a change that meets every rule", () => {
    expect(change().success).toBe(true);
  });

  it("requires the current password", () => {
    expect(change({ currentPassword: "" }).success).toBe(false);
  });

  it("requires the confirmation to match", () => {
    const result = change({ confirmPassword: "something-else-9A" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("refuses a new password identical to the current one", () => {
    // A change that changes nothing would report success and revoke the other
    // sessions for no reason.
    const same = "Correct-Horse-9";
    const result = change({
      currentPassword: same,
      newPassword: same,
      confirmPassword: same,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["newPassword"]);
  });

  it("enforces the minimum length", () => {
    const short = "Ab1" + "c".repeat(MIN_PASSWORD_LENGTH - 4);
    expect(short.length).toBeLessThan(MIN_PASSWORD_LENGTH);
    expect(change({ newPassword: short, confirmPassword: short }).success).toBe(
      false,
    );
  });

  it("caps the length where bcrypt stops reading", () => {
    // bcrypt truncates at 72 bytes, so anything longer adds no strength and
    // would make two different passwords interchangeable at sign-in.
    const long = "Ab1" + "c".repeat(MAX_PASSWORD_LENGTH);
    expect(change({ newPassword: long, confirmPassword: long }).success).toBe(
      false,
    );
  });

  it("requires an uppercase letter, a lowercase letter and a digit", () => {
    for (const weak of [
      "alllowercase-1", // no uppercase
      "ALLUPPERCASE-1", // no lowercase
      "NoDigitsInHere", // no digit
    ]) {
      expect(
        change({ newPassword: weak, confirmPassword: weak }).success,
        `"${weak}" should be rejected`,
      ).toBe(false);
    }
  });

  it("refuses unexpected fields", () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword: "old-password-1A",
      newPassword: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
      adminId: "someone-else",
    });

    // The account is the session's. An id in the body must not be accepted,
    // even to be ignored.
    expect(result.success).toBe(false);
  });
});
