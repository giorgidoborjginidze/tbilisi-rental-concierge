import { describe, expect, it } from "vitest";
import { anyForeign, asCurrency, gelPer, toGel, belowMarketPct, fromGel } from "./convert";

const rates = { USD: 2.7, EUR: 3 };

describe("currency conversion to lari", () => {
  it("converts dollars and euros at the given rate and keeps lari", () => {
    expect(toGel(1000, "USD", rates)).toBe(2700);
    expect(toGel(100, "eur", rates)).toBe(300);
    expect(toGel(50, "GEL", rates)).toBe(50);
  });

  it("treats an unknown or empty currency as lari", () => {
    expect(asCurrency("RUB")).toBe("GEL");
    expect(gelPer(null, rates)).toBe(1);
  });

  it("knows when a total mixes currencies", () => {
    expect(anyForeign(["GEL", "GEL"])).toBe(false);
    expect(anyForeign(["GEL", "USD"])).toBe(true);
  });
});

describe("belowMarketPct and fromGel", () => {
  const rates = { USD: 2.7, EUR: 3 };
  it("compares a dollar rent with a lari market in lari", () => {
    // $1,000 = 2,700 ₾ is above 2,000 ₾ — not "half the market".
    expect(belowMarketPct(1000, "USD", 2000, rates, 0.9)).toBeNull();
    expect(belowMarketPct(1000, "GEL", 2000, rates, 0.9)).toBe(50);
    expect(belowMarketPct(400, "USD", 2000, rates, 0.9)).toBe(46);
    expect(belowMarketPct(500, "USD", null, rates, 0.9)).toBeNull();
  });
  it("turns a lari average into the unit's currency", () => {
    expect(fromGel(270, "USD", rates)).toBeCloseTo(100);
    expect(fromGel(270, "GEL", rates)).toBe(270);
  });
});
