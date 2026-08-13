// Flip maths: buy a fixer-upper, renovate, sell. A very common way to
// invest in Georgian property, and a different question from buy-to-let —
// there is no rent, the money is made once, and *how long you held it*
// decides whether the deal was actually good. Pure and framework-free,
// like lib/invest/calc.ts.

export interface FlipInputs {
  /** Purchase price, GEL. */
  price: number;
  /** Renovation budget, GEL. */
  renovation: number;
  /** Notary, agent, transfer and other one-off buying costs, GEL. */
  buyingCosts: number;
  /** Utilities, security, loan interest… per month while holding, GEL. */
  monthlyHoldingCost: number;
  /** How long the property is held before it sells, in months. */
  holdingMonths: number;
  /** Expected sale price, GEL. */
  salePrice: number;
  /** Agent commission on the sale, % of sale price (0–100). */
  sellingFeePct: number;
  /** Tax on the gain, % (0–100). */
  taxPct: number;
}

export interface FlipResult {
  /** Everything paid out: purchase + renovation + buying + holding costs. */
  totalInvested: number;
  holdingCosts: number;
  /** Commission paid to the agent on the sale. */
  sellingFee: number;
  /** Sale price minus the selling fee. */
  netSaleProceeds: number;
  /** Profit before tax. */
  grossProfit: number;
  tax: number;
  /** What actually stays with the investor. */
  netProfit: number;
  /** netProfit ÷ totalInvested, %. */
  roiPct: number;
  /**
   * ROI restated as a yearly rate, so a flip can be compared with rent,
   * a deposit or anything else. A 12% return in 6 months is not 12% a
   * year — it is ~25%.
   */
  annualizedPct: number;
  /** Profit per month held. */
  profitPerMonth: number;
  /** Sale price at which the deal breaks even (net profit = 0). */
  breakEvenPrice: number;
  verdict: "good" | "ok" | "poor";
}

export function analyzeFlip(input: FlipInputs): FlipResult {
  const months = Math.max(1, input.holdingMonths);
  const holdingCosts = Math.max(0, input.monthlyHoldingCost) * months;
  const totalInvested =
    Math.max(0, input.price) +
    Math.max(0, input.renovation) +
    Math.max(0, input.buyingCosts) +
    holdingCosts;

  const feeRate = clampPct(input.sellingFeePct) / 100;
  const sellingFee = Math.max(0, input.salePrice) * feeRate;
  const netSaleProceeds = Math.max(0, input.salePrice) - sellingFee;

  const grossProfit = netSaleProceeds - totalInvested;
  // A loss is not taxed.
  const tax = grossProfit > 0 ? grossProfit * (clampPct(input.taxPct) / 100) : 0;
  const netProfit = grossProfit - tax;

  const roiPct = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;
  // Compound the period return up to a year: (1 + r)^(12/months) − 1.
  // Guarded because a total wipe-out (r ≤ −1) has no real annual rate.
  const r = roiPct / 100;
  const annualizedPct =
    totalInvested > 0 && r > -1 ? (Math.pow(1 + r, 12 / months) - 1) * 100 : -100;

  // Break-even: proceeds after commission must cover everything paid in.
  // salePrice × (1 − fee) = totalInvested  (no tax, since there is no gain)
  const breakEvenPrice = feeRate < 1 ? totalInvested / (1 - feeRate) : Infinity;

  return {
    totalInvested,
    holdingCosts,
    sellingFee,
    netSaleProceeds,
    grossProfit,
    tax,
    netProfit,
    roiPct,
    annualizedPct,
    profitPerMonth: netProfit / months,
    breakEvenPrice,
    verdict: verdictFor(annualizedPct),
  };
}

const clampPct = (v: number) => Math.min(100, Math.max(0, v || 0));

/** Judged on the annualized rate — the only fair way to rank flips of
 *  different lengths against each other and against renting out. */
function verdictFor(annualizedPct: number): FlipResult["verdict"] {
  if (annualizedPct >= 20) return "good";
  if (annualizedPct >= 8) return "ok";
  return "poor";
}
