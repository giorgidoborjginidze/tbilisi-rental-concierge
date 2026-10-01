// Amounts in more than one currency, added up in lari. Pure — the rates are
// loaded by ./gel-rates.ts (the National Bank of Georgia's daily rate).
//
// A rent, a booking, an income entry or a property value keeps the currency
// it was entered in (Tbilisi leases are often in dollars); only totals —
// the month's income, net worth — are converted, and those are marked as
// approximate when anything in them was converted.

export const CURRENCIES = ["GEL", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** GEL per one unit of each foreign currency. */
export interface GelRates {
  USD: number;
  EUR: number;
}

export function asCurrency(value: string | null | undefined): Currency {
  const code = (value ?? "").trim().toUpperCase();
  return (CURRENCIES as readonly string[]).includes(code) ? (code as Currency) : "GEL";
}

/** GEL per unit of `currency` (1 for lari). */
export function gelPer(currency: string | null | undefined, rates: GelRates): number {
  const code = asCurrency(currency);
  return code === "GEL" ? 1 : rates[code];
}

/** `amount` of `currency`, in lari. */
export function toGel(amount: number, currency: string | null | undefined, rates: GelRates): number {
  return amount * gelPer(currency, rates);
}

/** Is anything here in a currency other than lari (so a total is converted)? */
export function anyForeign(currencies: Iterable<string | null | undefined>): boolean {
  for (const currency of currencies) if (asCurrency(currency) !== "GEL") return true;
  return false;
}

/**
 * How far a rent sits below a lari market estimate, in percent — or null
 * when it is not below `ratio` of it. A rent in dollars or euros is put in
 * lari first, so "$1,000 against 2,000 ₾" is not called half the market.
 */
export function belowMarketPct(
  rent: number,
  rentCurrency: string | null | undefined,
  marketGel: number | null | undefined,
  rates: GelRates,
  ratio: number,
): number | null {
  if (!marketGel || marketGel <= 0) return null;
  const rentGel = toGel(rent, rentCurrency, rates);
  if (rentGel >= marketGel * ratio) return null;
  return Math.round((1 - rentGel / marketGel) * 100);
}

/** `amountGel` lari in `currency` (the opposite of toGel). */
export function fromGel(amountGel: number, currency: string | null | undefined, rates: GelRates): number {
  return amountGel / gelPer(currency, rates);
}
