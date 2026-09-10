import { describe, expect, it } from "vitest";
import { LOCK_BASE_MS, LOCK_MAX_MS, MAX_ATTEMPTS, lockDuration } from "./throttle-policy";

describe("lockDuration", () => {
  it("starts at the base delay on the first lock", () => {
    expect(lockDuration(MAX_ATTEMPTS)).toBe(LOCK_BASE_MS);
  });

  it("doubles for each further failure", () => {
    expect(lockDuration(MAX_ATTEMPTS + 1)).toBe(LOCK_BASE_MS * 2);
    expect(lockDuration(MAX_ATTEMPTS + 3)).toBe(LOCK_BASE_MS * 8);
  });

  it("stops growing at the ceiling", () => {
    expect(lockDuration(MAX_ATTEMPTS + 50)).toBe(LOCK_MAX_MS);
  });

  it("never returns a negative window for counts below the threshold", () => {
    expect(lockDuration(0)).toBe(LOCK_BASE_MS);
    expect(lockDuration(1)).toBe(LOCK_BASE_MS);
  });
});
