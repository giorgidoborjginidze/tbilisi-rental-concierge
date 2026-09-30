// How an amount owed is quoted — on screen, on the decide card and in the
// WhatsApp text. The ledger works to the tetri, so the figure quoted must
// never be less than what it needs: a 49.40 GEL balance shown as "49"
// would leave the day unpaid when the renter pays exactly what they were
// told. Amounts are therefore rounded UP to the tetri and shown with two
// decimals whenever they are not whole.
//
// The bare number, WITHOUT a currency, is for WhatsApp bodies whose
// template adds {currency}; on screen use lib/format.ts formatMoney /
// formatDueMoney, which add the sign. Pure and client-safe.

import { formatNumber } from "@/lib/number";

/** The amount to ask for: `value` rounded up to the tetri (float noise ignored). */
export function payableAmount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  // 49.4 * 100 is 4940.000000000001 — settle the noise before rounding up.
  const cents = Math.ceil(Math.round(value * 100 * 1000) / 1000);
  return cents / 100;
}

/** An amount owed, as it is quoted to the owner and to the renter. */
export const formatDue = (value: number): string => formatNumber(payableAmount(value), "auto");
