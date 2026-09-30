// How an income breakdown reads under a total: "Rent 1,200 · Daily 180 ·
// Other 250" — only the parts that are there, in the owner's language —
// and "partial" when booked nights still have no price.

import { t, type Locale } from "@/lib/i18n/strings";
import type { IncomeBreakdown } from "./income";

export function incomeParts(
  locale: Locale,
  income: IncomeBreakdown,
  format: (value: number) => string,
): string {
  return (
    [
      ["income_rent_short", income.rent],
      ["income_daily_short", income.daily],
      ["income_bookings_short", income.bookings],
      ["income_other_short", income.other],
    ] as const
  )
    .filter(([, value]) => Math.round(value) !== 0)
    .map(([key, value]) => `${t(locale, key)}: ${format(value)}`)
    .concat(income.unpricedNights > 0 ? [incomePartialShort(locale, income)] : [])
    .join(" · ");
}

/** "partial: 4 nights without a price" — empty when nothing is missing. */
export function incomePartialShort(locale: Locale, income: Pick<IncomeBreakdown, "unpricedNights">): string {
  return income.unpricedNights > 0
    ? t(locale, "income_partial_nights").replace("{n}", String(income.unpricedNights))
    : "";
}
