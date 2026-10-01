// Today's lari rates for dollars and euros, from the National Bank of
// Georgia — remembered in PriceQuote like the holdings' prices (USD shares
// the "fx:USDGEL" row with them). A known rate is used at once and, when
// due, refreshed after the page is sent, so no page waits on the NBG; only
// a first-ever rate is asked for while the page waits (within the time
// limit, else a built-in approximate one). Read once per request (React
// cache): every total on a page converts at the same rate.

import { cache } from "react";
import { prisma } from "@/lib/db";
import { FALLBACK_USD_GEL, fetchNbgRate } from "@/lib/crypto/prices";
import { dueForRefresh, FX_KEY, resolveQuote } from "@/lib/prices/freshness";
import { PRICE_TIMEOUT_MS, settleWithin } from "@/lib/prices/timeout";
import { inBackground } from "@/lib/prices/background";
import type { GelRates } from "./convert";

const KEYS = { USD: FX_KEY, EUR: "fx:EURGEL" } as const;
const FALLBACK: GelRates = { USD: FALLBACK_USD_GEL, EUR: 2.95 };

export const loadGelRates = cache(async (): Promise<GelRates> => {
  const now = new Date();
  const rows = await prisma.priceQuote
    .findMany({ where: { key: { in: Object.values(KEYS) } } })
    .catch(() => []);
  const stored = new Map(rows.map((row) => [row.key, row]));
  const out = { ...FALLBACK };

  const refresh = async (code: keyof GelRates): Promise<number | null> => {
    const key = KEYS[code];
    const fetched = await settleWithin(fetchNbgRate(code), PRICE_TIMEOUT_MS + 300, null);
    if (fetched == null || !Number.isFinite(fetched) || fetched <= 0) return null;
    await prisma.priceQuote
      .upsert({
        where: { key },
        create: { key, price: fetched, source: "nbg", fetchedAt: now },
        update: { price: fetched, source: "nbg", fetchedAt: now },
      })
      .catch(() => null);
    return fetched;
  };

  await Promise.all(
    (Object.keys(KEYS) as (keyof GelRates)[]).map(async (code) => {
      const row = stored.get(KEYS[code]);
      const known = resolveQuote("fx", row, null, now);
      if (dueForRefresh("fx", row, now)) {
        // A known rate is used at once and refreshed after the page is
        // sent; only a first-ever rate is waited for.
        if (known) inBackground(() => refresh(code));
        else {
          const fetched = await refresh(code);
          if (fetched != null) out[code] = fetched;
          return;
        }
      }
      if (known) out[code] = known.price;
    }),
  );
  return out;
});
