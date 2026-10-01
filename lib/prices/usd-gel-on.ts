// The USD→GEL rate of a given day, for a holding bought in lari: the price
// typed in ₾ is stored in USD (what holdings are quoted in) at the National
// Bank's official rate of the trade's date. When the NBG cannot be reached
// for that date, today's rate (live or last stored) is used; with neither,
// the caller asks for the price in USD instead of guessing.

import { loadQuotes } from "./quotes";
import { PRICE_TIMEOUT_MS, withTimeout } from "./timeout";

/** Parse the NBG currencies answer: GEL per one USD, or null. */
export function nbgUsdRate(data: unknown): number | null {
  const list = Array.isArray(data) ? data : [];
  const usd = (list[0] as { currencies?: { code?: string; rate?: number; quantity?: number }[] } | undefined)
    ?.currencies?.find((c) => c.code === "USD");
  return usd?.rate && usd.rate > 0 ? usd.rate / (usd.quantity || 1) : null;
}

export async function usdGelOn(day: Date): Promise<{ rate: number; exact: boolean } | null> {
  const key = day.toISOString().slice(0, 10);
  const to = withTimeout(PRICE_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json?currencies=USD&date=${key}`,
      { signal: to.signal, headers: { accept: "application/json" }, cache: "no-store" },
    );
    if (res.ok) {
      const rate = nbgUsdRate(await res.json());
      if (rate) return { rate, exact: true };
    }
  } catch {
    // fall through to today's rate
  } finally {
    to.done();
  }
  const { rate } = await loadQuotes([]);
  return rate.state === "fallback" ? null : { rate: rate.value, exact: false };
}
