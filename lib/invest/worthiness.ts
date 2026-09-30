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
  /**
   * How the rent is taxed. "gross" — Georgia, an individual letting a
   * home: a flat % of the rent received (5%), nothing deducted. "profit" —
   * the US-style model of the original spreadsheet: a % of the profit left
   * after loan interest, depreciation and points.
   */
  taxModel: TaxModel;
  /** "gross" model: tax on the rent received, %. */
  grossTaxPct: number;
  /** "profit" model: income tax rate on the profit, %. */
  incomeTaxPct: number;
  /** "profit" model: depreciable building share of price, % (rest is land). */
  buildingSharePct: number;
  /** "profit" model: straight-line depreciation period, years. */
  depreciationYears: number;
}

export type TaxModel = "gross" | "profit";

/** Georgian tax on rent an individual receives from a home, %. */
export const GEORGIAN_RENT_TAX_PCT = 5;

/**
 * The original spreadsheet's own scenario ($30k purchase, $500 rent, US
 * tax model: 20% on profit after interest and 27.5-year depreciation).
 * Kept to check the maths against the sheet — NOT what the page opens
 * with: 1.67% of the price in rent a month is not a Tbilisi flat.
 */
export const SHEET_SCENARIO: WorthinessInputs = {
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
  taxModel: "profit",
  grossTaxPct: GEORGIAN_RENT_TAX_PCT,
  incomeTaxPct: 20,
  buildingSharePct: 60,
  depreciationYears: 27.5,
};

/**
 * What the PRO calculator opens with: a Tbilisi flat in lari — Saburtalo,
 * 60 m² at the district estimates the free calculator uses (3,100 ₾/m²,
 * ~26 ₾/m² rent), cosmetic renovation, a GEL mortgage at the usual rate,
 * and Georgia's 5% tax on rent received. The page labels it an example
 * until the owner changes a figure.
 */
export const WORTHINESS_DEFAULTS_GEL: WorthinessInputs = {
  price: 186_000,
  equityPct: 30,
  otherInitialCosts: 15_000,
  annualRatePct: 11.5,
  loanYears: 15,
  monthlyRent: 1_550,
  rentGrowthPct: 3,
  vacancyPct: 8,
  insurancePerYear: 200,
  maintenancePct: 5,
  managementPct: 0,
  utilitiesPct: 0,
  brokerPct: 0,
  hoaPerYear: 240,
  propertyTaxPct: 0,
  pointsPct: 0,
  taxModel: "gross",
  grossTaxPct: GEORGIAN_RENT_TAX_PCT,
  incomeTaxPct: 20,
  buildingSharePct: 60,
  depreciationYears: 27.5,
};

/** The same example in dollars (at about 2.7 ₾/$, rounded). */
export const WORTHINESS_DEFAULTS_USD: WorthinessInputs = {
  ...WORTHINESS_DEFAULTS_GEL,
  price: 69_000,
  otherInitialCosts: 5_500,
  monthlyRent: 575,
  insurancePerYear: 75,
  hoaPerYear: 90,
};

export type WorthinessCurrency = "GEL" | "USD";

/** The example a currency opens with. */
export const worthinessDefaults = (currency: WorthinessCurrency): WorthinessInputs =>
  currency === "USD" ? WORTHINESS_DEFAULTS_USD : WORTHINESS_DEFAULTS_GEL;

/** Still the example the page opened with (nothing typed yet)? */
export function isWorthinessExample(inputs: WorthinessInputs, currency: WorthinessCurrency): boolean {
  const example = worthinessDefaults(currency);
  return (Object.keys(example) as (keyof WorthinessInputs)[]).every(
    (key) => inputs[key] === example[key],
  );
}

/**
 * Switching the currency does not convert anything. While the inputs are
 * still the example of the old currency, the other currency's example is
 * loaded (so "81,000 ₾" never turns into "81,000 $"); once the owner has
 * typed their own figures they are kept, and `kept` asks the page to say
 * that the amounts were not converted.
 */
export function switchWorthinessCurrency(
  inputs: WorthinessInputs,
  from: WorthinessCurrency,
  to: WorthinessCurrency,
): { inputs: WorthinessInputs; kept: boolean } {
  if (from === to) return { inputs, kept: false };
  return isWorthinessExample(inputs, from)
    ? { inputs: { ...worthinessDefaults(to) }, kept: false }
    : { inputs, kept: true };
}

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
  /** Profit before tax: NOI − interest − depreciation − points. */
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

  // Depreciation is a deduction of the profit model only; under the
  // Georgian 5%-of-rent regime nothing is deducted.
  const profitModel = inputs.taxModel === "profit";
  const depreciation =
    profitModel && inputs.depreciationYears > 0
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
    const incomeTax = profitModel
      ? Math.max(0, btIncome) * pct(inputs.incomeTaxPct)
      : goi * pct(inputs.grossTaxPct);
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
