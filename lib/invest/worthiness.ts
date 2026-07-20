// Investment-worthiness engine — a faithful port of the operator's
// underwriting spreadsheet (loan amortization, 5-year projection, tax
// treatment, return metrics), kept as a pure module so the UI shows
// only inputs and results; the algorithm itself stays server/lib-side.
//
// Three spreadsheet quirks were corrected on port (with the intent of
// each formula preserved): vacancy now multiplies income instead of
// being subtracted as an absolute; points amortization uses the points
// input rather than a hard-coded 20%; return ratios divide amounts in
// one consistent currency.

export interface WorthinessInputs {
  /** Purchase price (in the analysis currency). */
  price: number;
  /** Down payment, % of price (0–100). */
  equityPct: number;
  /** Renovation / closing money spent up front, beyond the down payment. */
  otherInitialCosts: number;
  /** Loan annual interest rate, %. */
  annualRatePct: number;
  loanYears: number;
  /** Month-1 rent for all units combined. */
  monthlyRent: number;
  /** Yearly rent increase, %. */
  rentGrowthPct: number;
  /** Expected vacancy, % of the year. */
  vacancyPct: number;
  /** Insurance, per year (absolute). */
  insurancePerYear: number;
  /** Maintenance, % of yearly rent. */
  maintenancePct: number;
  /** Property management, % of yearly rent. */
  managementPct: number;
  /** Utilities paid by owner, % of yearly rent. */
  utilitiesPct: number;
  /** Broker / platform fees, % of yearly rent. */
  brokerPct: number;
  /** HOA (ამხანაგობა), per year (absolute). */
  hoaPerYear: number;
  /** Property tax, % of purchase price per year. */
  propertyTaxPct: number;
  /** Points paid on the mortgage, % of the loan. */
  pointsPct: number;
  /** Income tax rate, %. */
  incomeTaxPct: number;
  /** Number of units the rent covers. */
  units: number;
  /** Depreciable building share of price, % (rest is land). */
  buildingSharePct: number;
  /** Straight-line depreciation period, years. */
  depreciationYears: number;
}

/** Sheet defaults, adapted (tax 20%, dep 27.5y, building 60%). */
export const WORTHINESS_DEFAULTS: WorthinessInputs = {
  price: 30000,
  equityPct: 20,
  otherInitialCosts: 1000,
  annualRatePct: 9,
  loanYears: 10,
  monthlyRent: 500,
  rentGrowthPct: 4,
  vacancyPct: 5,
  insurancePerYear: 51,
  maintenancePct: 6,
  managementPct: 0,
  utilitiesPct: 3,
  brokerPct: 0,
  hoaPerYear: 0,
  propertyTaxPct: 0,
  pointsPct: 0,
  incomeTaxPct: 20,
  units: 1,
  buildingSharePct: 60,
  depreciationYears: 27.5,
};

export interface YearRow {
  year: number;
  monthlyRent: number;
  yearlyRent: number;
  /** Gross operating income after vacancy. */
  goi: number;
  operatingExpenses: number;
  noi: number;
  loanInterest: number;
  principalPaydown: number;
  depreciation: number;
  pointsAmortization: number;
  /** Taxable income: NOI − interest − depreciation − points. */
  btIncome: number;
  incomeTax: number;
  atIncome: number;
  /** NOI − full debt service. */
  btCashFlow: number;
  atCashFlow: number;
  /** BT cash-on-cash: btCashFlow / total equity invested. */
  cocPct: number;
  /** AT cash-on-cash (ROE). */
  atCocPct: number;
  capRatePct: number;
  rentToPricePct: number;
  /** Owned share of the property after paydown. */
  equityPct: number;
  equityValue: number;
}

export interface WorthinessResult {
  loanAmount: number;
  downPayment: number;
  totalInvested: number;
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
  years: YearRow[];
  paybackYears: number | null;
  verdict: "good" | "ok" | "poor";
}

const pct = (v: number) => Math.min(100, Math.max(0, v)) / 100;

export function analyzeWorthiness(inputs: WorthinessInputs): WorthinessResult {
  const price = Math.max(0, inputs.price);
  const downPayment = price * pct(inputs.equityPct);
  const loanAmount = price - downPayment;
  const totalInvested = downPayment + Math.max(0, inputs.otherInitialCosts);

  // Monthly annuity payment (PMT), guarded for 0% and no-loan cases.
  const n = Math.max(0, Math.round(inputs.loanYears * 12));
  const r = inputs.annualRatePct / 100 / 12;
  const monthlyPayment =
    loanAmount <= 0 || n === 0
      ? 0
      : r === 0
        ? loanAmount / n
        : (loanAmount * r) / (1 - Math.pow(1 + r, -n));

  // Full amortization walk, summed per projection year (like the
  // sheet's payment-schedule columns).
  const interestByYear = [0, 0, 0, 0, 0];
  const principalByYear = [0, 0, 0, 0, 0];
  let balance = loanAmount;
  let totalInterest = 0;
  for (let m = 0; m < n; m++) {
    const interest = balance * r;
    const principal = Math.min(monthlyPayment - interest, balance);
    balance -= principal;
    totalInterest += interest;
    const year = Math.floor(m / 12);
    if (year < 5) {
      interestByYear[year] += interest;
      principalByYear[year] += principal;
    }
  }
  const totalPaid = loanAmount + totalInterest;

  const depreciation =
    inputs.depreciationYears > 0
      ? (price * pct(inputs.buildingSharePct)) / inputs.depreciationYears
      : 0;
  const pointsAmortization =
    inputs.loanYears > 0 ? (loanAmount * pct(inputs.pointsPct)) / inputs.loanYears : 0;

  const years: YearRow[] = [];
  let cumulativePrincipal = 0;
  let monthlyRent = inputs.monthlyRent;
  for (let y = 0; y < 5; y++) {
    if (y > 0) monthlyRent *= 1 + inputs.rentGrowthPct / 100;
    const yearlyRent = monthlyRent * 12;
    const goi = yearlyRent * (1 - pct(inputs.vacancyPct));
    const operatingExpenses =
      inputs.insurancePerYear +
      yearlyRent * pct(inputs.maintenancePct) +
      yearlyRent * pct(inputs.managementPct) +
      yearlyRent * pct(inputs.utilitiesPct) +
      yearlyRent * pct(inputs.brokerPct) +
      inputs.hoaPerYear +
      price * pct(inputs.propertyTaxPct);
    const noi = goi - operatingExpenses;

    const loanInterest = interestByYear[y];
    const principalPaydown = principalByYear[y];
    cumulativePrincipal += principalPaydown;

    const btIncome = noi - loanInterest - depreciation - pointsAmortization;
    const incomeTax = Math.max(0, btIncome) * pct(inputs.incomeTaxPct);
    const atIncome = btIncome - incomeTax;

    const btCashFlow = noi - loanInterest - principalPaydown;
    const atCashFlow = btCashFlow - incomeTax;

    const equityShare =
      price > 0 ? (downPayment + cumulativePrincipal) / price : 0;

    years.push({
      year: y + 1,
      monthlyRent,
      yearlyRent,
      goi,
      operatingExpenses,
      noi,
      loanInterest,
      principalPaydown,
      depreciation,
      pointsAmortization,
      btIncome,
      incomeTax,
      atIncome,
      btCashFlow,
      atCashFlow,
      cocPct: totalInvested > 0 ? (btCashFlow / totalInvested) * 100 : 0,
      atCocPct: totalInvested > 0 ? (atCashFlow / totalInvested) * 100 : 0,
      capRatePct: price > 0 ? (noi / price) * 100 : 0,
      rentToPricePct: price > 0 ? (monthlyRent / price) * 100 : 0,
      equityPct: equityShare * 100,
      equityValue: equityShare * price,
    });
  }

  const y1 = years[0];
  const paybackYears = y1.btCashFlow > 0 ? totalInvested / y1.btCashFlow : null;

  // Verdict score (intentionally not surfaced in the UI).
  let score = 0;
  if (y1.capRatePct >= 8) score += 2;
  else if (y1.capRatePct >= 5) score += 1;
  if (y1.atCocPct >= 10) score += 2;
  else if (y1.atCocPct >= 6) score += 1;
  if (y1.atCashFlow > 0) score += 1;
  if (y1.rentToPricePct >= 1) score += 1;
  if (paybackYears != null && paybackYears <= 6) score += 2;
  else if (paybackYears != null && paybackYears <= 10) score += 1;
  const verdict: WorthinessResult["verdict"] =
    score >= 6 ? "good" : score >= 3 ? "ok" : "poor";

  return {
    loanAmount,
    downPayment,
    totalInvested,
    monthlyPayment,
    totalPaid,
    totalInterest,
    years,
    paybackYears,
    verdict,
  };
}
