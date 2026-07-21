// Car-rental investment math + mock market reference data.
//
// Same stance as PRICE_PER_SQM / RentBenchmark: market figures are
// approximate, editable averages for Georgia — not live listings. Swap
// for a real, compliant source later without touching the calculator.

/** Mock market averages per popular rental model (GEL). */
export interface CarMarketEntry {
  /** Average purchase price on the secondary market. */
  avgPrice: number;
  /** Typical daily rental rate. */
  avgDailyRate: number;
}

export const CAR_MARKET: Record<string, CarMarketEntry> = {
  "Toyota Prius": { avgPrice: 32_000, avgDailyRate: 90 },
  "Toyota Camry": { avgPrice: 58_000, avgDailyRate: 160 },
  "Toyota RAV4": { avgPrice: 75_000, avgDailyRate: 180 },
  "Toyota Land Cruiser Prado": { avgPrice: 145_000, avgDailyRate: 320 },
  "Kia Sportage": { avgPrice: 68_000, avgDailyRate: 170 },
  "Hyundai Tucson": { avgPrice: 62_000, avgDailyRate: 160 },
  "Hyundai Elantra": { avgPrice: 45_000, avgDailyRate: 120 },
  "Honda CR-V": { avgPrice: 60_000, avgDailyRate: 150 },
  "Mitsubishi Pajero": { avgPrice: 55_000, avgDailyRate: 170 },
  "Mercedes-Benz E-Class": { avgPrice: 95_000, avgDailyRate: 250 },
  "BMW X5": { avgPrice: 130_000, avgDailyRate: 300 },
};

export const CAR_MODELS = Object.keys(CAR_MARKET);

/** Default running costs (insurance, service, cleaning, amortization),
 * as a percent of gross rental income. */
export const DEFAULT_CAR_COSTS_PCT = 30;
/** Default rented days per month for a daily-rental car. */
export const DEFAULT_CAR_DAYS = 18;

export interface CarInput {
  /** Purchase price, GEL. */
  price: number;
  /** Daily rental rate, GEL. */
  dailyRate: number;
  /** Days actually rented per month (0..31). */
  daysPerMonth: number;
  /** Running costs as % of gross income (0..100). */
  costsPct: number;
}

export interface CarResult {
  grossMonthly: number;
  netMonthly: number;
  /** Net annual income / purchase price, %. */
  annualYieldPct: number;
  /** Years to recover the price from net income; null when income ≤ 0. */
  paybackYears: number | null;
}

export function evaluateCar(input: CarInput): CarResult {
  const grossMonthly = input.dailyRate * input.daysPerMonth;
  const netMonthly = grossMonthly * (1 - input.costsPct / 100);
  const annualNet = netMonthly * 12;
  return {
    grossMonthly,
    netMonthly,
    annualYieldPct: input.price > 0 ? (annualNet / input.price) * 100 : 0,
    paybackYears:
      annualNet > 0 && input.price > 0 ? input.price / annualNet : null,
  };
}

export interface MarketComparison {
  /** (price − market avg) / market avg × 100; negative = cheaper. */
  deltaPct: number;
  /** "below" | "above" | "at" — with a ±5% neutral band. */
  verdict: "below" | "above" | "at";
}

export function compareToMarket(
  price: number,
  market: CarMarketEntry,
): MarketComparison {
  const deltaPct = ((price - market.avgPrice) / market.avgPrice) * 100;
  return {
    deltaPct,
    verdict: deltaPct < -5 ? "below" : deltaPct > 5 ? "above" : "at",
  };
}
