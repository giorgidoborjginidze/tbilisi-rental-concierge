import { describe, expect, it } from "vitest";
import {
  analyzeWorthiness,
  isWorthinessExample,
  SHEET_SCENARIO,
  WORTHINESS_DEFAULTS_GEL,
  WORTHINESS_DEFAULTS_USD,
  type WorthinessInputs,
} from "./worthiness";

// The spreadsheet's own scenario: $30k purchase, 20% down, 9% / 10y,
// $500 rent growing 4%/yr, 5% vacancy, $51 insurance, 6% maintenance,
// 3% utilities, 20% tax, $1k extra initial costs.
const sheet: WorthinessInputs = { ...SHEET_SCENARIO };

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

describe("the example the page opens with", () => {
  it("is a Tbilisi flat in lari, taxed the Georgian way", () => {
    expect(WORTHINESS_DEFAULTS_GEL.taxModel).toBe("gross");
    expect(WORTHINESS_DEFAULTS_GEL.grossTaxPct).toBe(5);
    // Rent under 1% of the price a month, like the market — not 1.67%.
    expect(WORTHINESS_DEFAULTS_GEL.monthlyRent / WORTHINESS_DEFAULTS_GEL.price).toBeLessThan(0.01);
  });

  it("does not open on 'worth it'", () => {
    expect(analyzeWorthiness(WORTHINESS_DEFAULTS_GEL).verdict).not.toBe("good");
  });

  it("the dollar example is the lari one at about 2.7 ₾/$", () => {
    expect(WORTHINESS_DEFAULTS_GEL.price / WORTHINESS_DEFAULTS_USD.price).toBeCloseTo(2.7, 1);
    expect(WORTHINESS_DEFAULTS_GEL.monthlyRent / WORTHINESS_DEFAULTS_USD.monthlyRent).toBeCloseTo(2.7, 1);
    expect(analyzeWorthiness(WORTHINESS_DEFAULTS_USD).verdict).toBe(
      analyzeWorthiness(WORTHINESS_DEFAULTS_GEL).verdict,
    );
  });

  it("counts as an example only until a figure changes", () => {
    expect(isWorthinessExample({ ...WORTHINESS_DEFAULTS_GEL }, "GEL")).toBe(true);
    expect(isWorthinessExample({ ...WORTHINESS_DEFAULTS_GEL, monthlyRent: 1_600 }, "GEL")).toBe(false);
    expect(isWorthinessExample({ ...WORTHINESS_DEFAULTS_GEL }, "USD")).toBe(false);
  });
});

describe("tax models", () => {
  // Audit case: a cash deal of 150,000 ₾ at 1,500 ₾ a month.
  const cash: WorthinessInputs = {
    ...WORTHINESS_DEFAULTS_GEL,
    price: 150_000,
    equityPct: 100,
    otherInitialCosts: 0,
    monthlyRent: 1_500,
    vacancyPct: 5,
  };

  it("Georgian: 5% of the rent received, nothing deducted", () => {
    const y1 = analyzeWorthiness(cash).years[0];
    expect(y1.incomeTax).toBeCloseTo(1_500 * 12 * 0.95 * 0.05, 6); // 855 a year, ~71 a month
    expect(y1.depreciation).toBe(0);
  });

  it("the US model is still there when chosen", () => {
    const y1 = analyzeWorthiness({ ...cash, taxModel: "profit" }).years[0];
    expect(y1.depreciation).toBeCloseTo((150_000 * 0.6) / 27.5, 6);
    expect(y1.incomeTax).toBeCloseTo(Math.max(0, y1.btIncome) * 0.2, 6);
  });

  it("the Georgian tax is due even when the loan leaves a loss", () => {
    const y1 = analyzeWorthiness({ ...cash, equityPct: 20, monthlyRent: 500 }).years[0];
    expect(y1.btIncome).toBeLessThan(0);
    expect(y1.incomeTax).toBeGreaterThan(0);
  });
});

describe("switchWorthinessCurrency", () => {
  it("loads the other currency's example while the inputs are untouched", async () => {
    const { switchWorthinessCurrency, WORTHINESS_DEFAULTS_GEL } = await import("./worthiness");
    const toUsd = switchWorthinessCurrency({ ...WORTHINESS_DEFAULTS_GEL }, "GEL", "USD");
    expect(toUsd).toEqual({ inputs: WORTHINESS_DEFAULTS_USD, kept: false });
    const back = switchWorthinessCurrency(toUsd.inputs, "USD", "GEL");
    expect(back).toEqual({ inputs: WORTHINESS_DEFAULTS_GEL, kept: false });
  });

  it("keeps the owner's own figures and says they were not converted", async () => {
    const { switchWorthinessCurrency, WORTHINESS_DEFAULTS_GEL } = await import("./worthiness");
    const mine = { ...WORTHINESS_DEFAULTS_GEL, price: 150_000 };
    expect(switchWorthinessCurrency(mine, "GEL", "USD")).toEqual({ inputs: mine, kept: true });
    expect(switchWorthinessCurrency(mine, "GEL", "GEL")).toEqual({ inputs: mine, kept: false });
  });
});
