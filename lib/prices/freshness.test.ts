import { describe, expect, it } from "vitest";
import { ageOf, dueForRefresh, quoteKey, resolveQuote } from "./freshness";

const now = new Date("2026-09-30T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;

describe("dueForRefresh", () => {
  it("asks when nothing is stored", () => {
    expect(dueForRefresh("crypto", undefined, now)).toBe(true);
  });
  it("uses a young stored price without asking", () => {
    expect(dueForRefresh("crypto", { key: "crypto:bitcoin", price: 1, fetchedAt: ago(MIN) }, now)).toBe(false);
  });
  it("asks again once the stored price has aged", () => {
    expect(dueForRefresh("crypto", { key: "crypto:bitcoin", price: 1, fetchedAt: ago(3 * MIN) }, now)).toBe(true);
    expect(dueForRefresh("fx", { key: "fx:USDGEL", price: 2.7, fetchedAt: ago(30 * MIN) }, now)).toBe(false);
  });
  it("asks when the stored price is not a usable price", () => {
    expect(dueForRefresh("stock", { key: "stock:AAPL", price: 0, fetchedAt: ago(MIN) }, now)).toBe(true);
  });
});

describe("resolveQuote", () => {
  const stored = { key: "crypto:bitcoin", price: 60_000, fetchedAt: ago(3 * 60 * MIN) };

  it("prefers what the source just answered", () => {
    expect(resolveQuote("crypto", stored, 64_000, now)).toEqual({ price: 64_000, fetchedAt: now, fresh: true });
  });
  it("falls back to the last good price, marked not fresh when old", () => {
    expect(resolveQuote("crypto", stored, undefined, now)).toEqual({
      price: 60_000,
      fetchedAt: stored.fetchedAt,
      fresh: false,
    });
  });
  it("keeps a recent stored price fresh", () => {
    const recent = { ...stored, fetchedAt: ago(5 * MIN) };
    expect(resolveQuote("crypto", recent, null, now)?.fresh).toBe(true);
  });
  it("never turns a failed price into 0", () => {
    expect(resolveQuote("crypto", undefined, 0, now)).toBeNull();
    expect(resolveQuote("crypto", undefined, Number.NaN, now)).toBeNull();
    expect(resolveQuote("crypto", stored, 0, now)?.price).toBe(60_000);
  });
});

describe("ageOf", () => {
  it("says it the way a person would", () => {
    expect(ageOf(ago(20_000), now)).toEqual({ unit: "now" });
    expect(ageOf(ago(12 * MIN), now)).toEqual({ unit: "min", n: 12 });
    expect(ageOf(ago(3 * 60 * MIN), now)).toEqual({ unit: "hour", n: 3 });
    expect(ageOf(ago(3 * 24 * 60 * MIN), now)).toEqual({ unit: "day", n: 3 });
  });
});

describe("quoteKey", () => {
  it("normalises ids per kind", () => {
    expect(quoteKey("crypto", "Bitcoin ")).toBe("crypto:bitcoin");
    expect(quoteKey("stock", "aapl")).toBe("stock:AAPL");
    expect(quoteKey("metal", "xau")).toBe("metal:XAU");
  });
});
