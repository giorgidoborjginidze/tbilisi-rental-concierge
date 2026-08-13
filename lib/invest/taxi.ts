// Taxi maths. Running a car on Bolt/Yandex is a different business from
// renting it out: the fares are bigger but so are the costs, and the two
// that decide it — fuel and wear — scale with how hard the car is driven,
// not with how much it is worth.
//
// Two bottom lines are reported on purpose:
//   cashMonthly — what lands in your pocket this month
//   netMonthly  — the same, minus the value the car quietly loses
// Taxi drivers routinely see the first and forget the second, which is
// why a car "earning well" can still be losing money.

export interface TaxiInputs {
  /** Purchase price, GEL. */
  price: number;
  /** Gross fares taken on a working day, before any deduction, GEL. */
  grossPerDay: number;
  /** Days actually driven per month (0..31). */
  daysPerMonth: number;
  /** Platform commission (Bolt, Yandex…), % of gross fares. */
  platformPct: number;
  /** Fuel burned on a working day, GEL. */
  fuelPerDay: number;
  /** Service, tyres, washing… per month, GEL. */
  servicePerMonth: number;
  /** Insurance and tech inspection, per year, GEL. */
  insurancePerYear: number;
  /** Value lost per year, % of price. Taxi mileage makes this steep. */
  depreciationPct: number;
  /** A hired driver's cut, % of fares after platform commission.
   *  Zero when you drive the car yourself. */
  driverSharePct: number;
}

export interface TaxiResult {
  grossMonthly: number;
  platformFee: number;
  fuelMonthly: number;
  driverShare: number;
  /** Service plus one month of insurance. */
  runningMonthly: number;
  depreciationMonthly: number;
  /** Cash left this month, before counting the car's lost value. */
  cashMonthly: number;
  /** The honest figure: cash minus depreciation. */
  netMonthly: number;
  /** netMonthly × 12 ÷ price, %. */
  annualYieldPct: number;
  /** Years for the cash to buy the car back; null if it never does. */
  paybackYears: number | null;
  verdict: "good" | "ok" | "poor";
}

const pct = (v: number) => Math.min(100, Math.max(0, v || 0)) / 100;
const pos = (v: number) => Math.max(0, v || 0);

export function evaluateTaxi(input: TaxiInputs): TaxiResult {
  const days = Math.min(31, pos(input.daysPerMonth));
  const grossMonthly = pos(input.grossPerDay) * days;

  const platformFee = grossMonthly * pct(input.platformPct);
  const afterPlatform = grossMonthly - platformFee;
  // A hired driver is paid out of what is left after the platform's cut.
  const driverShare = afterPlatform * pct(input.driverSharePct);

  const fuelMonthly = pos(input.fuelPerDay) * days;
  const runningMonthly = pos(input.servicePerMonth) + pos(input.insurancePerYear) / 12;
  const depreciationMonthly = (pos(input.price) * pct(input.depreciationPct)) / 12;

  const cashMonthly = afterPlatform - driverShare - fuelMonthly - runningMonthly;
  const netMonthly = cashMonthly - depreciationMonthly;

  const price = pos(input.price);
  const annualNet = netMonthly * 12;
  const annualCash = cashMonthly * 12;

  return {
    grossMonthly,
    platformFee,
    fuelMonthly,
    driverShare,
    runningMonthly,
    depreciationMonthly,
    cashMonthly,
    netMonthly,
    annualYieldPct: price > 0 ? (annualNet / price) * 100 : 0,
    paybackYears: annualCash > 0 && price > 0 ? price / annualCash : null,
    verdict: verdictFor(price > 0 ? (annualNet / price) * 100 : 0),
  };
}

/** Graded harder than passive rent: a taxi is a job, not an investment,
 *  so it has to clear a higher bar to be worth the hours. */
function verdictFor(annualYieldPct: number): TaxiResult["verdict"] {
  if (annualYieldPct >= 25) return "good";
  if (annualYieldPct >= 12) return "ok";
  return "poor";
}

/** Sensible Georgian starting points, editable in the UI. */
export const TAXI_DEFAULTS = {
  grossPerDay: 150,
  daysPerMonth: 26,
  platformPct: 20,
  fuelPerDay: 35,
  servicePerMonth: 250,
  insurancePerYear: 800,
  depreciationPct: 15,
  driverSharePct: 0,
} as const;
