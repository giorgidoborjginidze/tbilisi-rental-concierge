import { describe, expect, it } from "vitest";
import {
  analyzeWorthiness,
  WORTHINESS_DEFAULTS,
  type WorthinessInputs,
} from "./worthiness";

// The spreadsheet's own scenario: $30k purchase, 20% down, 9% / 10y,
// $500 rent growing 4%/yr, 5% vacancy, $51 insurance, 6% maintenance,
// 3% utilities, 20% tax, $1k extra initial costs.
const sheet: WorthinessInputs = { ...WORTHINESS_DEFAULTS };

describe("loan math (matches the spreadsheet's PMT block exactly)", () => {
  const r = analyzeWorthiness(sheet);

  it("splits price into loan and down payment", () => {
    expect(r.loanAmount).toBe(24000);
    expect(r.downPayment).toBe(6000);
    expect(r.totalInvested).toBe(7000);
  });

  it("computes the PMT payment", () => {
    expect(r.monthlyPayment).toBeCloseTo(304.021857, 5); // sheet B17
  });

  it("sums year-1 interest and principal like the payment schedule", () => {
    expect(r.years[0].loanInterest).toBeCloseTo(2097.048198, 4); // sheet G24
    expect(r.years[0].principalPaydown).toBeCloseTo(1551.214086, 4); // sheet G47
  });

  it("sums year-5 interest like the payment schedule", () => {
    expect(r.years[4].loanInterest).toBeCloseTo(1427.846168, 4); // sheet K24
  });

  it("computes total interest over the life of the loan", () => {
    expect(r.totalInterest).toBeCloseTo(12482.62284, 3); // sheet B21
    expect(r.totalPaid).toBeCloseTo(36482.62284, 3); // sheet B19
  });
});

describe("projection (sheet's intent with the vacancy bug corrected)", () => {
  const r = analyzeWorthiness(sheet);
  const y1 = r.years[0];

  it("grows rent 4% per year", () => {
    expect(r.years[1].monthlyRent).toBeCloseTo(520, 5);
    expect(r.years[4].monthlyRent).toBeCloseTo(584.92928, 4); // sheet K3
  });

  it("applies vacancy multiplicatively", () => {
    expect(y1.goi).toBeCloseTo(6000 * 0.95, 5); // 5700, not 5999.05
  });

  it("totals operating expenses like the sheet", () => {
    // insurance 51 + maintenance 6%*6000 + utilities 3%*6000 = 591 (sheet G18)
    expect(y1.operatingExpenses).toBeCloseTo(591, 5);
  });

  it("computes NOI, depreciation and taxable income", () => {
    expect(y1.noi).toBeCloseTo(5109, 5);
    expect(y1.depreciation).toBeCloseTo(654.5454545, 5); // sheet G25
    // points are 0 → no hard-coded 480 amortization
    expect(y1.pointsAmortization).toBe(0);
    expect(y1.btIncome).toBeCloseTo(5109 - 2097.048198 - 654.5454545, 4);
  });

  it("computes cash flows and returns in one currency", () => {
    const btcf = 5109 - 2097.048198 - 1551.214086;
    expect(y1.btCashFlow).toBeCloseTo(btcf, 4);
    expect(y1.cocPct).toBeCloseTo((btcf / 7000) * 100, 4);
    expect(y1.capRatePct).toBeCloseTo((5109 / 30000) * 100, 5);
    expect(y1.rentToPricePct).toBeCloseTo((500 / 30000) * 100, 5);
  });

  it("tracks owned equity in the property", () => {
    expect(y1.equityValue).toBeCloseTo(6000 + 1551.214086, 3); // sheet G56
    expect(r.years[4].equityPct).toBeGreaterThan(r.years[0].equityPct);
  });

  it("computes the payback period from year-1 BT cash flow", () => {
    const btcf = 5109 - 2097.048198 - 1551.214086;
    expect(r.paybackYears).toBeCloseTo(7000 / btcf, 4);
  });
});

describe("edge cases", () => {
  it("handles an all-cash purchase (100% equity)", () => {
    const r = analyzeWorthiness({ ...sheet, equityPct: 100 });
    expect(r.loanAmount).toBe(0);
    expect(r.monthlyPayment).toBe(0);
    expect(r.years[0].loanInterest).toBe(0);
    expect(r.years[0].btCashFlow).toBeCloseTo(r.years[0].noi, 5);
  });

  it("handles a 0% interest loan as straight-line", () => {
    const r = analyzeWorthiness({ ...sheet, annualRatePct: 0 });
    expect(r.monthlyPayment).toBeCloseTo(24000 / 120, 5);
    expect(r.totalInterest).toBeCloseTo(0, 6);
  });

  it("no tax is charged on a taxable loss", () => {
    const r = analyzeWorthiness({ ...sheet, monthlyRent: 100 });
    expect(r.years[0].btIncome).toBeLessThan(0);
    expect(r.years[0].incomeTax).toBe(0);
  });

  it("points amortization follows the points input", () => {
    const r = analyzeWorthiness({ ...sheet, pointsPct: 20 });
    expect(r.years[0].pointsAmortization).toBeCloseTo((24000 * 0.2) / 10, 5); // 480
  });

  it("never yields a payback for a cash-negative deal", () => {
    const r = analyzeWorthiness({ ...sheet, monthlyRent: 100 });
    expect(r.paybackYears).toBeNull();
    expect(r.verdict).toBe("poor");
  });

  it("rates the sheet's own scenario as a good deal", () => {
    // 17% cap rate, ~4.8y payback — clearly worth it.
    expect(analyzeWorthiness(sheet).verdict).toBe("good");
  });
});
