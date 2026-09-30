import { describe, expect, it } from "vitest";
import { analyzeInvestment, annuityPayment, type InvestInputs } from "./calc";

const base: InvestInputs = {
  price: 200_000,
  renovation: 20_000,
  monthlyRent: 1_500,
  vacancyPct: 0,
  incomeTaxPct: 0,
  useLoan: false,
  downPaymentPct: 20,
  annualRatePct: 12,
  termYears: 10,
  depositRatePct: 9.5,
};

describe("annuityPayment", () => {
  it("matches the standard annuity formula", () => {
    // 100,000 at 12%/yr over 10 years → 1,434.71/mo (classic reference value)
    expect(annuityPayment(100_000, 12, 10)).toBeCloseTo(1434.71, 1);
  });

  it("handles a zero interest rate as straight-line", () => {
    expect(annuityPayment(120_000, 0, 10)).toBeCloseTo(1000, 5);
  });

  it("returns 0 for a zero principal or term", () => {
    expect(annuityPayment(0, 12, 10)).toBe(0);
    expect(annuityPayment(100_000, 12, 0)).toBe(0);
  });
});

describe("analyzeInvestment (cash purchase)", () => {
  const r = analyzeInvestment(base);

  it("sums price and renovation into the investment", () => {
    expect(r.totalInvestment).toBe(220_000);
    expect(r.cashInvested).toBe(220_000);
    expect(r.loanPrincipal).toBe(0);
    expect(r.monthlyPayment).toBe(0);
  });

  it("computes gross and net yields", () => {
    // 1500 × 12 / 220000 = 8.18%
    expect(r.grossYieldPct).toBeCloseTo(8.18, 2);
    expect(r.netYieldPct).toBeCloseTo(8.18, 2); // no vacancy/tax
  });

  it("computes the payback period", () => {
    expect(r.paybackYears).toBeCloseTo(220_000 / (1500 * 12), 5);
  });
});

describe("analyzeInvestment (vacancy and tax)", () => {
  it("applies vacancy then income tax to the rent", () => {
    const r = analyzeInvestment({ ...base, vacancyPct: 10, incomeTaxPct: 5 });
    expect(r.effectiveMonthlyRent).toBeCloseTo(1350, 5);
    expect(r.netMonthlyIncome).toBeCloseTo(1350 * 0.95, 5);
  });
});

describe("analyzeInvestment (mortgage)", () => {
  const r = analyzeInvestment({ ...base, useLoan: true });

  it("splits cash vs loan by the down payment", () => {
    expect(r.loanPrincipal).toBe(160_000); // 80% of price
    expect(r.cashInvested).toBe(60_000); // 20% down + renovation
  });

  it("computes payment and total loan cost", () => {
    expect(r.monthlyPayment).toBeCloseTo(2295.54, 1);
    expect(r.totalLoanCost).toBeCloseTo(r.monthlyPayment * 120, 5);
  });

  it("reports negative cash flow when the payment exceeds rent", () => {
    expect(r.monthlyCashFlow).toBeLessThan(0);
    expect(r.cashPaybackYears).toBeNull(); // never repays from cash flow
  });

  it("recovers cash payback when cash flow is positive", () => {
    const cheap = analyzeInvestment({
      ...base,
      useLoan: true,
      annualRatePct: 4,
      termYears: 30,
      monthlyRent: 2_000,
    });
    expect(cheap.monthlyCashFlow).toBeGreaterThan(0);
    expect(cheap.cashPaybackYears).toBeCloseTo(
      cheap.cashInvested / (cheap.monthlyCashFlow * 12),
      5,
    );
  });
});

describe("analyzeInvestment (verdict vs deposit)", () => {
  it("flags a clearly better-than-deposit yield as good", () => {
    const r = analyzeInvestment({ ...base, monthlyRent: 2_200 }); // ~12% net
    expect(r.verdict).toBe("good");
  });

  it("flags a roughly at-par yield as ok", () => {
    const r = analyzeInvestment({ ...base, monthlyRent: 1_700 }); // ~9.3%
    expect(r.verdict).toBe("ok");
  });

  it("flags a below-deposit yield as poor", () => {
    const r = analyzeInvestment({ ...base, monthlyRent: 900 }); // ~4.9%
    expect(r.verdict).toBe("poor");
  });

  it("compares against deposit income on the same cash", () => {
    const r = analyzeInvestment(base);
    expect(r.depositMonthlyIncome).toBeCloseTo((220_000 * 0.095) / 12, 5);
  });
});

describe("analyzeInvestment (like-for-like with the verdict)", () => {
  // Audit scenario: Saburtalo, 60 m², all defaults (201,000 invested, 20%
  // down, 11.5% over 10 years, rent 1,560, 8% vacancy, 5% tax).
  const saburtalo: InvestInputs = {
    price: 186_000,
    renovation: 15_000,
    monthlyRent: 1_560,
    vacancyPct: 8,
    incomeTaxPct: 5,
    useLoan: true,
    downPaymentPct: 20,
    annualRatePct: 11.5,
    termYears: 10,
    depositRatePct: 9.5,
  };

  it("sets rent before the loan against the WHOLE investment on deposit", () => {
    const r = analyzeInvestment(saburtalo);
    expect(r.depositMonthlyIncome).toBeCloseTo((201_000 * 0.095) / 12, 5); // 1,591
    expect(r.depositOnCashMonthly).toBeCloseTo((r.cashInvested * 0.095) / 12, 5); // 413
    // The verdict says the deposit earns more — and so does the tile now.
    expect(r.verdict).toBe("poor");
    expect(r.netMonthlyIncome).toBeLessThan(r.depositMonthlyIncome);
  });

  it("a better-than-deposit verdict always shows a bigger rent than deposit", () => {
    const r = analyzeInvestment({ ...saburtalo, monthlyRent: 2_600 });
    expect(r.verdict).toBe("good");
    expect(r.netMonthlyIncome).toBeGreaterThan(r.depositMonthlyIncome);
  });

  it("takes upkeep out of the net income", () => {
    const without = analyzeInvestment({ ...base, vacancyPct: 10, incomeTaxPct: 5 });
    const withUpkeep = analyzeInvestment({ ...base, vacancyPct: 10, incomeTaxPct: 5, upkeepPct: 5 });
    expect(withUpkeep.upkeepMonthly).toBeCloseTo(1350 * 0.05, 5);
    expect(withUpkeep.netMonthlyIncome).toBeCloseTo(without.netMonthlyIncome - 1350 * 0.05, 5);
    expect(withUpkeep.netYieldPct).toBeLessThan(without.netYieldPct);
  });
});

