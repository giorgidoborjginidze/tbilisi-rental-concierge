// Approximate market reference data for the investment calculator.
// All values are MOCK averages (same stance as MarketDataSource /
// RentBenchmark): editable defaults, not live market data. Swap for a
// real, compliant source later without touching the calculator.

/** Average purchase price, GEL per m², by district (mock). */
export const PRICE_PER_SQM: Record<string, number> = {
  Vake: 4300,
  Vera: 4000,
  Saburtalo: 3100,
  "Old Town": 4200,
  Mtatsminda: 4100,
  "Batumi Boulevard": 2900,
};

/** Renovation cost, GEL per m², by finish level (mock averages). */
export const RENOVATION_PER_SQM = {
  none: 0,
  cosmetic: 250,
  medium: 500,
  full: 900,
} as const;

export type RenovationLevel = keyof typeof RENOVATION_PER_SQM;

export const RENOVATION_LEVELS = Object.keys(
  RENOVATION_PER_SQM,
) as RenovationLevel[];

/** Typical GEL mortgage annual rate, %. */
export const DEFAULT_MORTGAGE_RATE = 11.5;
/** Typical GEL term deposit annual rate, % (the "do nothing" alternative). */
export const DEFAULT_DEPOSIT_RATE = 9.5;
/** Georgian rental income tax for individuals, %. */
export const DEFAULT_INCOME_TAX = 5;
/** Default vacancy allowance, % of the year the unit sits empty. */
export const DEFAULT_VACANCY = 8;
