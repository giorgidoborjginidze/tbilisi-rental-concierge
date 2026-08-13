import { describe, expect, it } from "vitest";
import { evaluateTaxi, type TaxiInputs } from "./taxi";

// Round numbers so the arithmetic stays checkable by hand.
const base: TaxiInputs = {
  price: 30_000,
  grossPerDay: 100,
  daysPerMonth: 20,
  platformPct: 20,
  fuelPerDay: 30,
  servicePerMonth: 200,
  insurancePerYear: 1_200,
  depreciationPct: 12,
  driverSharePct: 0,
};

describe("evaluateTaxi", () => {
  it("takes the platform cut, fuel and running costs off the fares", () => {
    const r = evaluateTaxi(base);
    expect(r.grossMonthly).toBe(2_000);
    expect(r.platformFee).toBe(400);
    expect(r.fuelMonthly).toBe(600);
    expect(r.runningMonthly).toBe(300); // 200 service + 1200/12 insurance
    // 2000 − 400 − 600 − 300
    expect(r.cashMonthly).toBe(700);
  });

  it("separates cash in pocket from the value the car loses", () => {
    const r = evaluateTaxi(base);
    expect(r.depreciationMonthly).toBe(300); // 30 000 × 12% ÷ 12
    expect(r.netMonthly).toBe(400);
    expect(r.cashMonthly).toBeGreaterThan(r.netMonthly);
  });

  it("pays a hired driver out of what is left after the platform", () => {
    const r = evaluateTaxi({ ...base, driverSharePct: 50 });
    expect(r.driverShare).toBe(800); // 50% of (2000 − 400)
    expect(r.cashMonthly).toBe(-100);
    expect(r.paybackYears).toBeNull();
  });

  it("yields on the honest figure, and pays back on the cash one", () => {
    const r = evaluateTaxi(base);
    // 400 × 12 ÷ 30 000
    expect(r.annualYieldPct).toBeCloseTo(16, 6);
    // 30 000 ÷ (700 × 12)
    expect(r.paybackYears).toBeCloseTo(3.571, 3);
  });

  it("grades a taxi harder than passive rent", () => {
    expect(evaluateTaxi(base).verdict).toBe("ok");
    expect(evaluateTaxi({ ...base, grossPerDay: 160 }).verdict).toBe("good");
    expect(evaluateTaxi({ ...base, grossPerDay: 70 }).verdict).toBe("poor");
  });

  it("shows heavy depreciation eating an apparently healthy month", () => {
    const r = evaluateTaxi({ ...base, depreciationPct: 30 });
    expect(r.cashMonthly).toBe(700); // pocket looks the same…
    expect(r.netMonthly).toBe(-50); // …but the car lost more than it earned
    expect(r.verdict).toBe("poor");
  });

  it("never lets days worked exceed a month", () => {
    expect(evaluateTaxi({ ...base, daysPerMonth: 90 }).grossMonthly).toBe(3_100);
  });
});
