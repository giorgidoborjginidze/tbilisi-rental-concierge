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
