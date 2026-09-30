import { describe, expect, it } from "vitest";
import { analyzeFlip, type FlipInputs } from "./flip";

const base: FlipInputs = {
  price: 100_000,
  renovation: 20_000,
  buyingCosts: 0,
  monthlyHoldingCost: 0,
  holdingMonths: 12,
  salePrice: 150_000,
  sellingFeePct: 0,
  taxPct: 0,
};

describe("analyzeFlip", () => {
  it("profits by sale minus everything paid in", () => {
    const r = analyzeFlip(base);
    expect(r.totalInvested).toBe(120_000);
    expect(r.netProfit).toBe(30_000);
    expect(r.roiPct).toBeCloseTo(25, 5);
  });

  it("counts holding costs for every month held", () => {
    const r = analyzeFlip({ ...base, monthlyHoldingCost: 200, holdingMonths: 6 });
    expect(r.holdingCosts).toBe(1_200);
    expect(r.totalInvested).toBe(121_200);
  });

  it("annualizes a short hold upward and a long hold downward", () => {
    const half = analyzeFlip({ ...base, holdingMonths: 6 });
    const double = analyzeFlip({ ...base, holdingMonths: 24 });
    // Same 25% return, earned in half the time, is worth far more a year.
    expect(half.annualizedPct).toBeCloseTo(56.25, 2);
    expect(double.annualizedPct).toBeCloseTo(11.803, 2);
    expect(half.annualizedPct).toBeGreaterThan(double.annualizedPct);
  });

  it("takes commission off the sale and tax off the gain", () => {
    const r = analyzeFlip({ ...base, sellingFeePct: 2, taxPct: 5 });
    expect(r.sellingFee).toBe(3_000);
    expect(r.netSaleProceeds).toBe(147_000);
    expect(r.grossProfit).toBe(27_000);
    expect(r.tax).toBeCloseTo(1_350, 6);
    expect(r.netProfit).toBeCloseTo(25_650, 6);
  });

  it("does not tax a loss", () => {
    const r = analyzeFlip({ ...base, salePrice: 90_000, taxPct: 20 });
    expect(r.tax).toBe(0);
    expect(r.netProfit).toBeLessThan(0);
    expect(r.verdict).toBe("poor");
  });

  it("break-even is the price that clears the outlay after commission", () => {
    const r = analyzeFlip({ ...base, sellingFeePct: 4 });
    expect(r.breakEvenPrice).toBeCloseTo(125_000, 6);
    // Selling at exactly break-even leaves nothing.
    const atBreakEven = analyzeFlip({
      ...base,
      sellingFeePct: 4,
      salePrice: r.breakEvenPrice,
    });
    expect(atBreakEven.netProfit).toBeCloseTo(0, 6);
  });

  it("rates by the annual rate, not the headline return", () => {
    // 10% earned in 3 months annualizes to ~46% — a good deal.
    expect(analyzeFlip({ ...base, salePrice: 132_000, holdingMonths: 3 }).verdict)
      .toBe("good");
    // The same 10%, but it took three years.
    expect(analyzeFlip({ ...base, salePrice: 132_000, holdingMonths: 36 }).verdict)
      .toBe("poor");
  });
});

describe("analyzeFlip (verdict against a deposit)", () => {
  // 15% a year: above the default 9.5% deposit, below a strong 19.5%.
  const fifteen = { ...base, holdingMonths: 12 };
  const at = (annual: number) => analyzeFlip({ ...fifteen, salePrice: 0 }).totalInvested * (1 + annual / 100);

  it("calls a return above a deposit modest, never 'about a deposit'", () => {
    const r = analyzeFlip({ ...fifteen, salePrice: at(15), sellingFeePct: 0, taxPct: 0 });
    expect(r.annualizedPct).toBeCloseTo(15, 6);
    expect(r.verdict).toBe("ok");
    expect(r.thresholds).toEqual({ strongPct: 19.5, depositPct: 9.5 });
  });

  it("is weak below the deposit rate and strong 10 points above it", () => {
    expect(analyzeFlip({ ...fifteen, salePrice: at(9), sellingFeePct: 0, taxPct: 0 }).verdict).toBe("poor");
    expect(analyzeFlip({ ...fifteen, salePrice: at(19.6), sellingFeePct: 0, taxPct: 0 }).verdict).toBe("good");
  });

  it("follows a different deposit rate", () => {
    const r = analyzeFlip({ ...fifteen, salePrice: at(15), sellingFeePct: 0, taxPct: 0, depositRatePct: 16 });
    expect(r.verdict).toBe("poor");
  });
});

