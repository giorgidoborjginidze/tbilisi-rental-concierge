import { describe, expect, it } from "vitest";
import { CAR_MARKET, compareToMarket, evaluateCar } from "./car";

describe("evaluateCar", () => {
  it("computes gross and net monthly income", () => {
    const r = evaluateCar({ price: 60_000, dailyRate: 150, daysPerMonth: 20, costsPct: 30 });
    expect(r.grossMonthly).toBe(3000);
    expect(r.netMonthly).toBe(2100);
  });

  it("computes annual yield against the price", () => {
    const r = evaluateCar({ price: 60_000, dailyRate: 150, daysPerMonth: 20, costsPct: 30 });
    // 2100 × 12 / 60000 = 42%
    expect(r.annualYieldPct).toBeCloseTo(42, 5);
  });

  it("computes payback in years", () => {
    const r = evaluateCar({ price: 60_000, dailyRate: 150, daysPerMonth: 20, costsPct: 30 });
    expect(r.paybackYears).toBeCloseTo(60_000 / (2100 * 12), 5);
  });

  it("returns null payback when nothing is rented", () => {
    const r = evaluateCar({ price: 60_000, dailyRate: 150, daysPerMonth: 0, costsPct: 30 });
    expect(r.netMonthly).toBe(0);
    expect(r.paybackYears).toBeNull();
  });

  it("handles 100% costs without negative surprises", () => {
    const r = evaluateCar({ price: 50_000, dailyRate: 100, daysPerMonth: 15, costsPct: 100 });
    expect(r.netMonthly).toBe(0);
    expect(r.paybackYears).toBeNull();
  });
});

describe("compareToMarket", () => {
  const camry = CAR_MARKET["Toyota Camry"]; // avg 58,000

  it("flags a clearly cheaper price as below market", () => {
    const c = compareToMarket(50_000, camry);
    expect(c.verdict).toBe("below");
    expect(c.deltaPct).toBeLessThan(0);
  });

  it("flags a clearly higher price as above market", () => {
    const c = compareToMarket(70_000, camry);
    expect(c.verdict).toBe("above");
    expect(c.deltaPct).toBeGreaterThan(5);
  });

  it("treats ±5% as in line with the market", () => {
    expect(compareToMarket(58_000, camry).verdict).toBe("at");
    expect(compareToMarket(59_500, camry).verdict).toBe("at");
    expect(compareToMarket(56_000, camry).verdict).toBe("at");
  });

  it("computes the delta percentage exactly", () => {
    expect(compareToMarket(63_800, camry).deltaPct).toBeCloseTo(10, 5);
  });
});
