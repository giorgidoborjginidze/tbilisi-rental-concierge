// Live stock prices via Stooq (free, no API key). Quotes are USD for the
// US market. Like the crypto fetchers, every call is best-effort and
// time-limited; on failure lib/prices/quotes.ts uses the last good price
// with its age.

import { PRICE_TIMEOUT_MS, withTimeout } from "@/lib/prices/timeout";
//
// Prices are fetched server-side (works on Vercel). A local dev box
// without outbound network simply returns {}.

// A small starter list of popular tickers → company name. Users can also
// type any US ticker manually.
export const POPULAR_STOCKS: Record<string, string> = {
  AAPL: "Apple",
  MSFT: "Microsoft",
  NVDA: "NVIDIA",
  GOOGL: "Alphabet (Google)",
  AMZN: "Amazon",
  META: "Meta",
  TSLA: "Tesla",
  NFLX: "Netflix",
  AMD: "AMD",
  INTC: "Intel",
  KO: "Coca-Cola",
  PEP: "PepsiCo",
  DIS: "Disney",
  V: "Visa",
  MA: "Mastercard",
  JPM: "JPMorgan Chase",
  BAC: "Bank of America",
  WMT: "Walmart",
  MCD: "McDonald's",
  NKE: "Nike",
  PLTR: "Palantir",
  UBER: "Uber",
  ABNB: "Airbnb",
  COIN: "Coinbase",
  BABA: "Alibaba",
};

/**
 * Latest USD price per US ticker → { TICKER: usdPrice }.
 *
 * With FINNHUB_API_KEY set, Finnhub (reliable from datacenter IPs) and
 * Stooq are asked AT THE SAME TIME and Finnhub wins where both answer —
 * one after the other, a hanging Finnhub used to double the wait. Both
 * are best-effort — a missing ticker just won't appear in the result.
 */
export async function fetchStockPrices(
  tickers: string[],
  timeoutMs = PRICE_TIMEOUT_MS,
): Promise<Record<string, number>> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()))].filter(Boolean);
  if (unique.length === 0) return {};

  const key = process.env.FINNHUB_API_KEY?.trim();
  if (key) {
    const [primary, secondary] = await Promise.all([
      fetchFinnhub(unique, key, timeoutMs),
      fetchStooq(unique, timeoutMs),
    ]);
    return { ...secondary, ...primary };
  }

  return fetchStooq(unique, timeoutMs);
}

/** Finnhub /quote — one request per symbol (free tier: 60/min). */
async function fetchFinnhub(
  tickers: string[],
  key: string,
  timeoutMs: number,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    tickers.map(async (ticker) => {
      const to = withTimeout(timeoutMs);
      try {
        const url =
          "https://finnhub.io/api/v1/quote?symbol=" +
          encodeURIComponent(ticker) +
          "&token=" +
          encodeURIComponent(key);
        const res = await fetch(url, {
          signal: to.signal,
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) return;
        // { c: current, d, dp, h, l, o, pc, t } — c is 0 for unknown symbols.
        const data = (await res.json()) as { c?: number };
        if (typeof data.c === "number" && data.c > 0) out[ticker] = data.c;
      } catch {
        // best-effort
      } finally {
        to.done();
      }
    }),
  );
  return out;
}

/** Stooq wants lowercase symbols with a market suffix (US assumed). */
const stooqSymbol = (ticker: string) => `${ticker.trim().toLowerCase()}.us`;

/** Stooq light CSV quote endpoint (symbol,date,time,o,h,l,close,vol). */
async function fetchStooq(tickers: string[], timeoutMs: number): Promise<Record<string, number>> {
  if (tickers.length === 0) return {};
  const to = withTimeout(timeoutMs);
  try {
    const symbols = tickers.map(stooqSymbol).join(",");
    const url =
      "https://stooq.com/q/l/?s=" +
      encodeURIComponent(symbols) +
      "&f=sd2t2ohlcv&h&e=csv";
    const res = await fetch(url, {
      signal: to.signal,
      headers: { accept: "text/csv" },
      cache: "no-store",
    });
    if (!res.ok) return {};
    const text = await res.text();
    const out: Record<string, number> = {};
    const rows = text.trim().split(/\r?\n/).slice(1); // drop header
    for (const row of rows) {
      const cols = row.split(",");
      const sym = (cols[0] ?? "").replace(/\.US$/i, "").toUpperCase();
      const close = Number(cols[6]);
      if (sym && Number.isFinite(close) && close > 0) out[sym] = close;
    }
    return out;
  } catch {
    return {};
  } finally {
    to.done();
  }
}
