// Live crypto prices via CoinGecko (free, no key) and a USD→GEL rate
// via the National Bank of Georgia. All network calls are best-effort and
// time-limited (PRICE_TIMEOUT_MS): on any failure the caller gets nothing
// for that symbol, and lib/prices/quotes.ts falls back to the last good
// price it stored, labelled with its age.
//
// No framework caching (`cache: "no-store"`): the PriceQuote table is the
// cache, with an honest fetchedAt — a Next data-cache entry could be days
// old and still look "live".
//
// Note: prices are fetched server-side (works on Vercel). A local dev
// box without outbound network simply gets nothing back.

import { PRICE_TIMEOUT_MS, withTimeout } from "@/lib/prices/timeout";

/** Popular coins: display symbol → CoinGecko id. Extend as needed. */
export const COINS: Record<string, { id: string; name: string }> = {
  BTC: { id: "bitcoin", name: "Bitcoin" },
  ETH: { id: "ethereum", name: "Ethereum" },
  USDT: { id: "tether", name: "Tether" },
  USDC: { id: "usd-coin", name: "USD Coin" },
  BNB: { id: "binancecoin", name: "BNB" },
  SOL: { id: "solana", name: "Solana" },
  XRP: { id: "ripple", name: "XRP" },
  ADA: { id: "cardano", name: "Cardano" },
  DOGE: { id: "dogecoin", name: "Dogecoin" },
  TON: { id: "the-open-network", name: "Toncoin" },
  TRX: { id: "tron", name: "TRON" },
  AVAX: { id: "avalanche-2", name: "Avalanche" },
  DOT: { id: "polkadot", name: "Polkadot" },
  MATIC: { id: "matic-network", name: "Polygon" },
  LTC: { id: "litecoin", name: "Litecoin" },
  LINK: { id: "chainlink", name: "Chainlink" },
  SHIB: { id: "shiba-inu", name: "Shiba Inu" },
  BCH: { id: "bitcoin-cash", name: "Bitcoin Cash" },
  XLM: { id: "stellar", name: "Stellar" },
  ATOM: { id: "cosmos", name: "Cosmos" },
  NEAR: { id: "near", name: "NEAR Protocol" },
  APT: { id: "aptos", name: "Aptos" },
  ARB: { id: "arbitrum", name: "Arbitrum" },
  OP: { id: "optimism", name: "Optimism" },
  SUI: { id: "sui", name: "Sui" },
};

export const COIN_SYMBOLS = Object.keys(COINS);

/**
 * USD→GEL used only when the NBG never answered and no earlier rate is
 * stored — always shown as "approximate rate", never as the NBG rate.
 */
export const FALLBACK_USD_GEL = 2.72;

/** USD price per coin for the given CoinGecko ids → { id: usdPrice }. */
export async function fetchUsdPrices(
  ids: string[],
  timeoutMs = PRICE_TIMEOUT_MS,
): Promise<Record<string, number>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const to = withTimeout(timeoutMs);
  try {
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=" +
      encodeURIComponent(unique.join(",")) +
      "&vs_currencies=usd";
    const res = await fetch(url, {
      signal: to.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, { usd?: number }>;
    const out: Record<string, number> = {};
    for (const [id, v] of Object.entries(data)) {
      if (typeof v?.usd === "number") out[id] = v.usd;
    }
    return out;
  } catch {
    return {};
  } finally {
    to.done();
  }
}

/** Official USD→GEL rate from the NBG, or null when it does not answer. */
export async function fetchUsdGelRate(timeoutMs = PRICE_TIMEOUT_MS): Promise<number | null> {
  const to = withTimeout(timeoutMs);
  try {
    const res = await fetch(
      "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json?currencies=USD",
      { signal: to.signal, headers: { accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      currencies?: Array<{ code?: string; rate?: number; quantity?: number }>;
    }>;
    const usd = data?.[0]?.currencies?.find((c) => c.code === "USD");
    if (usd?.rate && usd.rate > 0) return usd.rate / (usd.quantity || 1);
    return null;
  } catch {
    return null;
  } finally {
    to.done();
  }
}
