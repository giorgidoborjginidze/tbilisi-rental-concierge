// Market prices for holdings, with a memory. Each price the source answers
// is stored (PriceQuote) with the time it answered; a stored price young
// enough is used without asking again, and when a source fails or hangs
// the last good price is used and shown with its age. A holding therefore
// never shows as worthless because an API had a bad minute, and a page
// never waits longer than PRICE_TIMEOUT_MS for one.

import { prisma } from "@/lib/db";
import { FALLBACK_USD_GEL, fetchUsdGelRate, fetchUsdPrices } from "@/lib/crypto/prices";
import { fetchStockPrices } from "@/lib/stocks/prices";
import { fetchMetalPrices } from "@/lib/metals/prices";
import { PRICE_TIMEOUT_MS, settleWithin } from "./timeout";
import {
  dueForRefresh,
  FX_KEY,
  quoteKey,
  resolveQuote,
  type FxRate,
  type Quote,
  type QuoteKind,
  type StoredQuote,
} from "./freshness";

export type { FxRate };

export type HoldingQuoteKind = Exclude<QuoteKind, "fx">;

export interface QuoteRequest {
  kind: HoldingQuoteKind;
  /** CoinGecko id for crypto; ticker / metal symbol otherwise. */
  id: string;
}

const SOURCE: Record<QuoteKind, string> = {
  crypto: "coingecko",
  stock: process.env.FINNHUB_API_KEY ? "finnhub" : "stooq",
  metal: "gold-api",
  fx: "nbg",
};

// Every source at once; whatever has not answered by then is left out.
const DEADLINE_MS = PRICE_TIMEOUT_MS + 300;
const none: Record<string, number> = {};

/**
 * Prices for the requested holdings (keyed by `quoteKey`) and the USD→GEL
 * rate. Asks only the sources whose stored price is due, all in parallel,
 * each within the time limit; stores what they answer.
 */
export async function loadQuotes(
  requests: QuoteRequest[],
  now: Date = new Date(),
): Promise<{ quotes: Map<string, Quote>; rate: FxRate }> {
  const wanted = new Map<string, QuoteRequest>();
  for (const request of requests) {
    if (request.id.trim()) wanted.set(quoteKey(request.kind, request.id), request);
  }
  const keys = [...wanted.keys(), FX_KEY];

  const rows: StoredQuote[] = await prisma.priceQuote
    .findMany({ where: { key: { in: keys } } })
    .catch(() => []);
  const stored = new Map(rows.map((row) => [row.key, row]));

  const due = (kind: HoldingQuoteKind) =>
    [...wanted.entries()]
      .filter(([key, request]) => request.kind === kind && dueForRefresh(kind, stored.get(key), now))
      .map(([, request]) => request.id);
  const cryptoIds = due("crypto");
  const stockTickers = due("stock");
  const metalSymbols = due("metal");
  const rateDue = dueForRefresh("fx", stored.get(FX_KEY), now);

  const [crypto, stocks, metals, rate] = await Promise.all([
    cryptoIds.length ? settleWithin(fetchUsdPrices(cryptoIds), DEADLINE_MS, none) : none,
    stockTickers.length ? settleWithin(fetchStockPrices(stockTickers), DEADLINE_MS, none) : none,
    metalSymbols.length ? settleWithin(fetchMetalPrices(metalSymbols), DEADLINE_MS, none) : none,
    rateDue ? settleWithin(fetchUsdGelRate(), DEADLINE_MS, null) : null,
  ]);

  // What the sources answered, by quote key.
  const fetched = new Map<string, number>();
  for (const [key, request] of wanted) {
    const answer =
      request.kind === "crypto"
        ? crypto[request.id]
        : request.kind === "stock"
          ? stocks[request.id.trim().toUpperCase()]
          : metals[request.id.trim().toUpperCase()];
    if (typeof answer === "number" && Number.isFinite(answer) && answer > 0) fetched.set(key, answer);
  }
  if (rate != null && Number.isFinite(rate) && rate > 0) fetched.set(FX_KEY, rate);

  // Remember them. A failed write costs nothing but the memory.
  await Promise.all(
    [...fetched.entries()].map(([key, price]) => {
      const kind = key.slice(0, key.indexOf(":")) as QuoteKind;
      return prisma.priceQuote
        .upsert({
          where: { key },
          create: { key, price, source: SOURCE[kind], fetchedAt: now },
          update: { price, source: SOURCE[kind], fetchedAt: now },
        })
        .catch(() => null);
    }),
  );

  const quotes = new Map<string, Quote>();
  for (const [key, request] of wanted) {
    const quote = resolveQuote(request.kind, stored.get(key), fetched.get(key), now);
    if (quote) quotes.set(key, quote);
  }

  const fx = resolveQuote("fx", stored.get(FX_KEY), fetched.get(FX_KEY), now);
  return {
    quotes,
    rate: fx
      ? { value: fx.price, fetchedAt: fx.fetchedAt, state: fx.fresh ? "live" : "stale" }
      : { value: FALLBACK_USD_GEL, fetchedAt: null, state: "fallback" },
  };
}
