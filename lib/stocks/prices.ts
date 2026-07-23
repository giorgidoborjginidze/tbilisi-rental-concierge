// Live stock prices via Stooq (free, no API key). Quotes are USD for the
// US market. Like the crypto fetchers, every call is best-effort: on any
// failure the caller gets null and the UI shows "—" gracefully.
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

const withTimeout = (ms: number) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
};

/** Stooq wants lowercase symbols with a market suffix (US assumed). */
const stooqSymbol = (ticker: string) => `${ticker.trim().toLowerCase()}.us`;

/**
 * Latest USD price per US ticker → { TICKER: usdPrice }.
 * Uses Stooq's light CSV quote endpoint (symbol,date,time,o,h,l,close,vol).
 */
export async function fetchStockPrices(
  tickers: string[],
): Promise<Record<string, number>> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()))].filter(Boolean);
  if (unique.length === 0) return {};
  const to = withTimeout(6000);
  try {
    const symbols = unique.map(stooqSymbol).join(",");
    const url =
      "https://stooq.com/q/l/?s=" +
      encodeURIComponent(symbols) +
      "&f=sd2t2ohlcv&h&e=csv";
    const res = await fetch(url, {
      signal: to.signal,
      headers: { accept: "text/csv" },
      // Quotes update through the trading day; 2-minute cache is plenty.
      next: { revalidate: 120 },
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
