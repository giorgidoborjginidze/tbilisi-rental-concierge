// How a price's age and the exchange rate are said on screen.

import { t, type Locale } from "@/lib/i18n/strings";
import { ageOf, type FxRate } from "./freshness";

export function priceAge(locale: Locale, fetchedAt: Date, now: Date = new Date()): string {
  const age = ageOf(fetchedAt, now);
  if (age.unit === "now") return t(locale, "price_age_now");
  const key = age.unit === "min" ? "price_age_min" : age.unit === "hour" ? "price_age_hour" : "price_age_day";
  return t(locale, key).replace("{n}", String(age.n));
}

const rateText = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 4 });

/** "In GEL at the National Bank rate: 1 $ = 2.6875 ₾ (2 h ago)." or the approximate-rate line. */
export function rateLine(locale: Locale, rate: FxRate, now: Date = new Date()): string {
  if (rate.state === "fallback" || !rate.fetchedAt) {
    return t(locale, "rate_fallback").replace("{rate}", rateText(rate.value));
  }
  return t(locale, "rate_nbg")
    .replace("{rate}", rateText(rate.value))
    .replace("{age}", priceAge(locale, rate.fetchedAt, now));
}
