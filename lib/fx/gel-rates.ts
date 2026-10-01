// Today's lari rates for dollars and euros, from the National Bank of
// Georgia — remembered in PriceQuote like the holdings' prices (USD shares
// the "fx:USDGEL" row with them), refreshed when due, and falling back to
// the last known rate (or a built-in approximate one) when the NBG does
// not answer, so a page never waits on it or shows nothing. Read once per
// request (React cache): every total on a page converts at the same rate.

import { cache } from "react";
import { prisma } from "@/lib/db";
import { FALLBACK_USD_GEL, fetchNbgRate } from "@/lib/crypto/prices";
import { dueForRefresh, FX_KEY, resolveQuote } from "@/lib/prices/freshness";
import { PRICE_TIMEOUT_MS, settleWithin } from "@/lib/prices/timeout";
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
  await Promise.all(
    (Object.keys(KEYS) as (keyof GelRates)[]).map(async (code) => {
      const key = KEYS[code];
      const row = stored.get(key);
      const fetched = dueForRefresh("fx", row, now)
        ? await settleWithin(fetchNbgRate(code), PRICE_TIMEOUT_MS + 300, null)
        : null;
      if (fetched != null && Number.isFinite(fetched) && fetched > 0) {
        await prisma.priceQuote
          .upsert({
            where: { key },
            create: { key, price: fetched, source: "nbg", fetchedAt: now },
            update: { price: fetched, source: "nbg", fetchedAt: now },
          })
          .catch(() => null);
      }
      const quote = resolveQuote("fx", row, fetched, now);
      if (quote) out[code] = quote.price;
    }),
  );
  return out;
});
