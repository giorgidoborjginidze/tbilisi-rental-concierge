import { describe, expect, it } from "vitest";
import { formatDue, formatMoney, payableAmount } from "./money";
import { contractTerms, statusFor } from "./terms";
import { applyPayment } from "./ledger";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("payableAmount", () => {
  it("rounds up to the tetri, ignoring float noise", () => {
    expect(payableAmount(49.4)).toBe(49.4);
    expect(payableAmount(49.401)).toBe(49.41);
    expect(payableAmount(0.1 + 0.2)).toBe(0.3);
    expect(payableAmount(60)).toBe(60);
    expect(payableAmount(0)).toBe(0);
    expect(payableAmount(-5)).toBe(0);
  });
});

describe("formatMoney / formatDue", () => {
  it("shows whole amounts plainly and fractions with two decimals", () => {
    expect(formatMoney(1200)).toBe("1,200");
    expect(formatMoney(49.4)).toBe("49.40");
    expect(formatDue(49.4)).toBe("49.40");
    expect(formatDue(49.401)).toBe("49.41");
    expect(formatDue(1826.4)).toBe("1,826.40");
  });

  it("quotes an amount that settles the owed day exactly", () => {
    // 60 / day, a 10.60 part payment kept as credit: 49.40 is still owed.
    const contract = {
      startDate: d("2026-09-01"),
      endDate: d("2026-12-01"),
      paymentPeriod: "daily",
      paymentAmount: 60,
      monthlyRent: 1826.4,
      graceDays: 3,
      paidThrough: d("2026-09-30"),
      creditBalance: 10.6,
    };
    const status = statusFor(contract, d("2026-09-30"), null);
    expect(status.amountDue).toBe(49.4);
    const quoted = Number(formatDue(status.amountDue).replace(/,/g, ""));
    const step = applyPayment(
      contractTerms(contract, null),
      { paidThrough: contract.paidThrough, credit: contract.creditBalance },
      quoted,
    );
    expect(step.state.paidThrough).toEqual(d("2026-10-01"));
    expect(step.state.credit).toBe(0);
  });
});
