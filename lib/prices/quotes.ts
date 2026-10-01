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
import { inBackground } from "./background";
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

interface FetchPlan {
  crypto: string[];
  stock: string[];
  metal: string[];
  rate: boolean;
}

/**
 * Asks the sources for the planned prices, all in parallel, each within the
 * time limit, and stores what they answer. Returns the answers by quote key.
 */
async function fetchAndStore(plan: FetchPlan, now: Date): Promise<Map<string, number>> {
  const fetched = new Map<string, number>();
  if (!plan.crypto.length && !plan.stock.length && !plan.metal.length && !plan.rate) return fetched;
  const [crypto, stocks, metals, rate] = await Promise.all([
    plan.crypto.length ? settleWithin(fetchUsdPrices(plan.crypto), DEADLINE_MS, none) : none,
    plan.stock.length ? settleWithin(fetchStockPrices(plan.stock), DEADLINE_MS, none) : none,
    plan.metal.length ? settleWithin(fetchMetalPrices(plan.metal), DEADLINE_MS, none) : none,
    plan.rate ? settleWithin(fetchUsdGelRate(), DEADLINE_MS, null) : null,
  ]);
  const keep = (kind: QuoteKind, id: string, answer: number | null | undefined) => {
    if (typeof answer === "number" && Number.isFinite(answer) && answer > 0) fetched.set(quoteKey(kind, id), answer);
  };
  for (const id of plan.crypto) keep("crypto", id, crypto[id]);
  for (const id of plan.stock) keep("stock", id, stocks[id.trim().toUpperCase()]);
  for (const id of plan.metal) keep("metal", id, metals[id.trim().toUpperCase()]);
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
  return fetched;
}

/**
 * Prices for the requested holdings (keyed by `quoteKey`) and the USD→GEL
 * rate. A known price is used at once (refreshed after the page when due);
 * only a price never seen before is asked for while the page waits.
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

  // A source is asked only for prices that are due. One with a known price
  // is refreshed after the page is sent (the page shows the known price
  // with its age); only a price never seen before is waited for.
  const due = (kind: HoldingQuoteKind, known: boolean) =>
    [...wanted.entries()]
      .filter(
        ([key, request]) =>
          request.kind === kind &&
          dueForRefresh(kind, stored.get(key), now) &&
          (resolveQuote(kind, stored.get(key), null, now) != null) === known,
      )
      .map(([, request]) => request.id);
  const rateDue = dueForRefresh("fx", stored.get(FX_KEY), now);
  const rateKnown = resolveQuote("fx", stored.get(FX_KEY), null, now) != null;

  const later: FetchPlan = {
    crypto: due("crypto", true),
    stock: due("stock", true),
    metal: due("metal", true),
    rate: rateDue && rateKnown,
  };
  if (later.crypto.length || later.stock.length || later.metal.length || later.rate) {
    inBackground(() => fetchAndStore(later, now));
  }
  const fetched = await fetchAndStore(
    { crypto: due("crypto", false), stock: due("stock", false), metal: due("metal", false), rate: rateDue && !rateKnown },
    now,
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
