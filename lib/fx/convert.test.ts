import { describe, expect, it } from "vitest";
import { anyForeign, asCurrency, gelPer, toGel } from "./convert";

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
