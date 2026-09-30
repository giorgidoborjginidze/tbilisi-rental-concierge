import { describe, expect, it } from "vitest";
import { dummyHash, hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const stored = await hashPassword("demo1234");
    expect(await verifyPassword("demo1234", stored)).toBe(true);
    expect(await verifyPassword("demo1235", stored)).toBe(false);
  });

  it("produces a different salt (and hash) every time", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored values", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });

  it("keeps a dummy hash that is well formed and matches nothing guessable", async () => {
    const stored = await dummyHash();
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await dummyHash()).toBe(stored);
    expect(await verifyPassword("", stored)).toBe(false);
    expect(await verifyPassword("test1234", stored)).toBe(false);
  });

  it("hashes without blocking the event loop", async () => {
    let ticked = false;
    const timer = new Promise<void>((resolve) => setImmediate(() => { ticked = true; resolve(); }));
    const hashing = hashPassword("parallel");
    await timer;
    expect(ticked).toBe(true);
    await hashing;
  });
});
