import { describe, expect, it } from "vitest";
import {
  contractIncomeInWindow,
  monthlyEquivalent,
  perDayAmount,
  perPeriodAmount,
} from "./amount";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

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

describe("contract income inside a window", () => {
  const september = { start: d("2026-09-01"), end: d("2026-10-01") };

  it("counts one night for a one-night stay, not a month", () => {
    const stay = {
      startDate: d("2026-09-30"),
      endDate: d("2026-10-01"),
      paymentPeriod: "daily",
      paymentAmount: 180,
      monthlyRent: monthlyEquivalent(180, "daily"),
    };
    expect(contractIncomeInWindow(stay, september)).toBe(180);
  });

  it("counts a whole month's rent for a month the lease covers", () => {
    const lease = {
      startDate: d("2026-03-01"),
      endDate: d("2027-03-01"),
      paymentPeriod: "monthly",
      paymentAmount: 1200,
      monthlyRent: 1200,
    };
    expect(contractIncomeInWindow(lease, september)).toBeCloseTo(1200, 6);
  });

  it("prorates the month a lease starts in", () => {
    const lease = {
      startDate: d("2026-09-16"),
      endDate: d("2027-09-16"),
      paymentPeriod: "monthly",
      paymentAmount: 1500,
      monthlyRent: 1500,
    };
    expect(contractIncomeInWindow(lease, september)).toBeCloseTo(750, 6);
  });

  it("counts a daily car by the days it ran", () => {
    const taxi = {
      startDate: d("2026-09-20"),
      endDate: d("2027-09-20"),
      paymentPeriod: "daily",
      paymentAmount: 60,
      monthlyRent: monthlyEquivalent(60, "daily"),
    };
    expect(contractIncomeInWindow(taxi, september)).toBe(11 * 60);
  });

  it("is zero outside the contract", () => {
    const lease = {
      startDate: d("2026-01-01"),
      endDate: d("2026-02-01"),
      paymentPeriod: "monthly",
      paymentAmount: 900,
      monthlyRent: 900,
    };
    expect(contractIncomeInWindow(lease, september)).toBe(0);
  });
});
