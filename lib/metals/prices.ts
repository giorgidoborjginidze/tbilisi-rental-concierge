// Live precious-metal prices via gold-api.com (free, no API key). Prices are
// USD per troy ounce. Like the crypto/stock fetchers, every call is
// best-effort: on failure the caller gets null and the UI shows "—".
//
// Fetched server-side (works on Vercel). A local box without outbound
// network simply returns {}.

/** Metal ticker → display name + Asset `type` value. */
export const METALS: Record<string, { name: string; type: string }> = {
  XAU: { name: "Gold", type: "gold" },
  XAG: { name: "Silver", type: "silver" },
  XPT: { name: "Platinum", type: "platinum" },
  XPD: { name: "Palladium", type: "palladium" },
};

export const METAL_SYMBOLS = Object.keys(METALS);

const withTimeout = (ms: number) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
};

/** USD price per troy ounce for the given metal tickers → { XAU: price }. */
export async function fetchMetalPrices(
  symbols: string[],
): Promise<Record<string, number>> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()))].filter(
    (s) => s in METALS,
  );
  if (unique.length === 0) return {};

  const out: Record<string, number> = {};
  await Promise.all(
    unique.map(async (symbol) => {
      const to = withTimeout(6000);
      try {
        const res = await fetch(`https://api.gold-api.com/price/${symbol}`, {
          signal: to.signal,
          headers: { accept: "application/json" },
          next: { revalidate: 300 },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { price?: number };
        if (typeof data.price === "number" && data.price > 0) out[symbol] = data.price;
      } catch {
        // best-effort
      } finally {
        to.done();
      }
    }),
  );
  return out;
}
