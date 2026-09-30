// How a contract's rent reads on screen: the amount per period with its
// period, "60 ₾ / day", "1,200 ₾ / mo" — never a daily price passed
// off as a monthly one.

import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { asPeriod, perPeriodAmount, type ContractAmounts } from "./amount";
import { formatMoney } from "@/lib/format";

export function periodWordKey(period: string): StringKey {
  const value = asPeriod(period);
  return value === "daily"
    ? "per_day_word"
    : value === "weekly"
      ? "per_week_word"
      : "per_month_word";
}

export const formatAmount = (value: number): string =>
  value.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** "60 ₾ / დღე" in the owner's language. */
export function rentLabel(
  locale: Locale,
  contract: ContractAmounts & { currency: string },
): string {
  return `${formatMoney(perPeriodAmount(contract), contract.currency, 2)} / ${t(
    locale,
    periodWordKey(contract.paymentPeriod),
  )}`;
}
