import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const stored = hashPassword("demo1234");
    expect(verifyPassword("demo1234", stored)).toBe(true);
    expect(verifyPassword("demo1235", stored)).toBe(false);
  });

  it("produces a different salt (and hash) every time", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("rejects malformed stored values", () => {
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
  });
});
