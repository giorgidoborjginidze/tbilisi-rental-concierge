// Pure investment math for the buy-to-let calculator. Framework-free
// and unit-tested, like lib/analytics and lib/pricing.

export interface InvestInputs {
  /** Purchase price, GEL. */
  price: number;
  /** Renovation budget, GEL (paid in cash up front). */
  renovation: number;
  /** Expected monthly rent, GEL. */
  monthlyRent: number;
  /** % of the year the unit is expected to sit empty (0–100). */
  vacancyPct: number;
  /** Rental income tax, % (0–100). */
  incomeTaxPct: number;
  /** Finance the purchase with a mortgage? */
  useLoan: boolean;
  /** Down payment, % of price (0–100). Ignored without a loan. */
  downPaymentPct: number;
  /** Mortgage annual interest rate, %. */
  annualRatePct: number;
  /** Mortgage term, years. */
  termYears: number;
  /** Bank deposit annual rate, % — the alternative for the same cash. */
  depositRatePct: number;
}

export interface InvestResult {
  /** price + renovation. */
  totalInvestment: number;
  /** Own cash actually paid out (total minus loan principal). */
  cashInvested: number;
  loanPrincipal: number;
  /** Monthly annuity payment (0 without a loan). */
  monthlyPayment: number;
  /** Total paid to the bank over the term (principal + interest). */
  totalLoanCost: number;
  /** Rent after the vacancy allowance. */
  effectiveMonthlyRent: number;
  /** After vacancy and income tax. */
  netMonthlyIncome: number;
  /** netMonthlyIncome minus the loan payment. */
  monthlyCashFlow: number;
  /** rent × 12 ÷ total investment, %. */
  grossYieldPct: number;
  /** net income × 12 ÷ total investment, %. */
  netYieldPct: number;
  /** Years for net income to repay the whole investment (no-loan view). */
  paybackYears: number | null;
  /** Years for post-loan cash flow to repay the cash invested. */
  cashPaybackYears: number | null;
  /** What the same cash would earn per month on deposit. */
  depositMonthlyIncome: number;
  verdict: "good" | "ok" | "poor";
}

/** Standard annuity payment; handles a 0% rate. */
export function annuityPayment(
  principal: number,
  annualRatePct: number,
  years: number,
): number {
  if (principal <= 0 || years <= 0) return 0;
  const n = Math.round(years * 12);
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function analyzeInvestment(inputs: InvestInputs): InvestResult {
  const price = Math.max(0, inputs.price);
  const renovation = Math.max(0, inputs.renovation);
  const totalInvestment = price + renovation;

  const loanPrincipal = inputs.useLoan
    ? price * (1 - Math.min(100, Math.max(0, inputs.downPaymentPct)) / 100)
    : 0;
  const cashInvested = totalInvestment - loanPrincipal;
  const monthlyPayment = annuityPayment(
    loanPrincipal,
    inputs.annualRatePct,
    inputs.termYears,
  );
  const totalLoanCost = monthlyPayment * Math.round(inputs.termYears * 12);

  const effectiveMonthlyRent =
    inputs.monthlyRent * (1 - Math.min(100, Math.max(0, inputs.vacancyPct)) / 100);
  const netMonthlyIncome =
    effectiveMonthlyRent *
    (1 - Math.min(100, Math.max(0, inputs.incomeTaxPct)) / 100);
  const monthlyCashFlow = netMonthlyIncome - monthlyPayment;

  const grossYieldPct =
    totalInvestment > 0 ? ((inputs.monthlyRent * 12) / totalInvestment) * 100 : 0;
  const netYieldPct =
    totalInvestment > 0 ? ((netMonthlyIncome * 12) / totalInvestment) * 100 : 0;

  const paybackYears =
    netMonthlyIncome > 0 ? totalInvestment / (netMonthlyIncome * 12) : null;
  const cashPaybackYears =
    monthlyCashFlow > 0 ? cashInvested / (monthlyCashFlow * 12) : null;

  const depositMonthlyIncome = (cashInvested * inputs.depositRatePct) / 100 / 12;

  // Unlevered net yield vs the deposit rate: clearly above → good,
  // roughly at par → ok, below → the deposit wins.
  const verdict: InvestResult["verdict"] =
    netYieldPct >= inputs.depositRatePct + 1.5
      ? "good"
      : netYieldPct >= inputs.depositRatePct - 1
        ? "ok"
        : "poor";

  return {
    totalInvestment,
    cashInvested,
    loanPrincipal,
    monthlyPayment,
    totalLoanCost,
    effectiveMonthlyRent,
    netMonthlyIncome,
    monthlyCashFlow,
    grossYieldPct,
    netYieldPct,
    paybackYears,
    cashPaybackYears,
    depositMonthlyIncome,
    verdict,
  };
}
