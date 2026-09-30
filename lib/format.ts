// How money reads on screen — one way, everywhere: the number with
// thousands separators, then the currency sign: "43,082 ₾", "60 ₾ / დღე",
// "1,250 $". The lari sign is a character of the text, not an icon.
//
// Whole units by default (portfolio values, income, prices); "auto" shows
// tetri only when there are any ("49.40 ₾") — for amounts owed, which are
// first rounded UP to the tetri (formatDueMoney), so the figure quoted is
// never less than what clears the debt. Pure and client-safe.

import { payableAmount } from "./rentals/money";

const SIGNS: Record<string, string> = { GEL: "₾", USD: "$", EUR: "€" };

/** The sign a currency code is shown with (unknown codes stay as codes). */
export function currencySign(code: string | null | undefined): string {
  if (!code) return "₾";
  return SIGNS[code.trim().toUpperCase()] ?? code.trim();
}

export type Decimals = "auto" | number;

/** "1,200" / "49.40" (auto) / "1,200.50" (2) — no currency. */
export function formatNumber(value: number, decimals: Decimals = 0): string {
  if (decimals === "auto") {
    const whole = Math.abs(value - Math.round(value)) < 0.005;
    return whole
      ? Math.round(value).toLocaleString("en-US")
      : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (decimals <= 0) return Math.round(value).toLocaleString("en-US");
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/** "43,082 ₾" — "—" when there is no figure. */
export function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined = "GEL",
  decimals: Decimals = 0,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${formatNumber(value, decimals)} ${currencySign(currency)}`;
}

/** An amount owed, rounded up to the tetri: "49.40 ₾", "1,200 ₾". */
export const formatDueMoney = (
  value: number,
  currency: string | null | undefined = "GEL",
): string => formatMoney(payableAmount(value), currency, "auto");
