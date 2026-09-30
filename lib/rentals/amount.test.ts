import { describe, expect, it } from "vitest";
import {
  monthlyEquivalent,
  perDayAmount,
  perPeriodAmount,
} from "./amount";

describe("per-period amounts and their monthly equivalent", () => {
  it("normalises a daily and a weekly rate to a month", () => {
    expect(monthlyEquivalent(60, "daily")).toBe(1826.4);
    expect(monthlyEquivalent(350, "weekly")).toBe(1520.75);
    expect(monthlyEquivalent(1200, "monthly")).toBe(1200);
  });

  it("charges what the owner typed per period", () => {
    const taxi = { paymentPeriod: "daily", paymentAmount: 60, monthlyRent: 1826.4 };
    expect(perPeriodAmount(taxi)).toBe(60);
    expect(perDayAmount(taxi)).toBe(60);
  });

  it("charges a legacy row (no paymentAmount) what it was charged before", () => {
    // Before the fix, monthlyRent held whatever was typed, per period.
    expect(
      perPeriodAmount({ paymentPeriod: "monthly", paymentAmount: null, monthlyRent: 1200 }),
    ).toBe(1200);
    expect(
      perPeriodAmount({ paymentPeriod: "weekly", paymentAmount: null, monthlyRent: 350 }),
    ).toBe(350);
  });
});
