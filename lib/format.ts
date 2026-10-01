// How money reads on screen — one way, everywhere: the number with
// thousands separators, then the currency sign: "43,082 ₾", "60 ₾ / დღე",
// "1,250 $". The lari sign is a character of the text, not an icon.
//
// Whole units by default (portfolio values, income, prices); "auto" shows
// tetri only when there are any ("49.40 ₾") — for amounts owed, which are
// first rounded UP to the tetri (formatDueMoney), so the figure quoted is
// never less than what clears the debt. Pure and client-safe.

import { payableAmount } from "./rentals/money";
import { formatNumber, type Decimals } from "./number";

export { formatNumber, formatQuantity, formatSignedPercent, type Decimals } from "./number";

const SIGNS: Record<string, string> = { GEL: "₾", USD: "$", EUR: "€" };

/** The sign a currency code is shown with (unknown codes stay as codes). */
export function currencySign(code: string | null | undefined): string {
  if (!code) return "₾";
  return SIGNS[code.trim().toUpperCase()] ?? code.trim();
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

/** formatMoney for running text (calculator results): a no-break space
 *  before the sign, so a line never ends on the figure with "₾" alone on
 *  the next. Not for messages or exports, which keep the plain space. */
export const formatMoneyInline = (...args: Parameters<typeof formatMoney>): string =>
  formatMoney(...args).replace(/ (?=[^ ]*$)/, "\u00a0");

/** An amount owed, rounded up to the tetri: "49.40 ₾", "1,200 ₾". */
export const formatDueMoney = (
  value: number,
  currency: string | null | undefined = "GEL",
): string => formatMoney(payableAmount(value), currency, "auto");
