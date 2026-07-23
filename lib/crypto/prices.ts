// Live crypto prices via CoinGecko (free, no key) and a USD→GEL rate
// via the National Bank of Georgia. All network calls are best-effort:
// on any failure the caller gets null and the UI shows "—" gracefully.
//
// Note: prices are fetched server-side (works on Vercel). A local dev
// box without outbound network simply returns null.

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

/** Fallback USD→GEL rate if the NBG API is unreachable (approximate). */
export const FALLBACK_USD_GEL = 2.72;

const withTimeout = (ms: number) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
};

/** USD price per coin for the given CoinGecko ids → { id: usdPrice }. */
export async function fetchUsdPrices(
  ids: string[],
): Promise<Record<string, number>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const to = withTimeout(6000);
  try {
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=" +
      encodeURIComponent(unique.join(",")) +
      "&vs_currencies=usd";
    const res = await fetch(url, {
      signal: to.signal,
      headers: { accept: "application/json" },
      // Revalidate at most every 2 minutes across requests.
      next: { revalidate: 120 },
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

/** Current USD→GEL rate from the NBG; falls back to a constant. */
export async function fetchUsdGel(): Promise<number> {
  const to = withTimeout(5000);
  try {
    const res = await fetch(
      "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json?currencies=USD",
      { signal: to.signal, headers: { accept: "application/json" }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return FALLBACK_USD_GEL;
    const data = (await res.json()) as Array<{
      currencies?: Array<{ code?: string; rate?: number; quantity?: number }>;
    }>;
    const usd = data?.[0]?.currencies?.find((c) => c.code === "USD");
    if (usd?.rate && usd.rate > 0) return usd.rate / (usd.quantity || 1);
    return FALLBACK_USD_GEL;
  } catch {
    return FALLBACK_USD_GEL;
  } finally {
    to.done();
  }
}
