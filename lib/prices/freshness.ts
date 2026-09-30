// How old a market price may be before it is asked for again, and before
// it stops counting as "live". Pure — the database and the network live
// in lib/prices/quotes.ts.

export type QuoteKind = "crypto" | "stock" | "metal" | "fx";

/** Ask the source again once the stored price is this old. */
export const REFRESH_AFTER_MS: Record<QuoteKind, number> = {
  crypto: 2 * 60_000,
  stock: 5 * 60_000,
  metal: 5 * 60_000,
  fx: 60 * 60_000,
};

/**
 * A price answered by its source within this window is "live"; older, it
 * is the last known price and is shown with its age. The NBG sets its
 * rate once a business day, so a rate stays live over a weekend.
 */
export const FRESH_FOR_MS: Record<QuoteKind, number> = {
  crypto: 15 * 60_000,
  stock: 30 * 60_000,
  metal: 30 * 60_000,
  fx: 36 * 3_600_000,
};

export const FX_KEY = "fx:USDGEL";

export const quoteKey = (kind: QuoteKind, id: string) =>
  `${kind}:${kind === "crypto" ? id.trim().toLowerCase() : id.trim().toUpperCase()}`;

export interface StoredQuote {
  key: string;
  price: number;
  fetchedAt: Date;
}

export interface Quote {
  price: number;
  /** When the source answered with this price. */
  fetchedAt: Date;
  /** Answered within FRESH_FOR_MS — may be called "live". */
  fresh: boolean;
}

export interface FxRate {
  /** GEL per USD. */
  value: number;
  /** When the NBG gave it (null for the built-in approximate rate). */
  fetchedAt: Date | null;
  /** live: the NBG answered recently; stale: its last known rate; fallback: approximate. */
  state: "live" | "stale" | "fallback";
}

const usable = (price: number | null | undefined): price is number =>
  typeof price === "number" && Number.isFinite(price) && price > 0;

/** Should the source be asked now (no price yet, or the stored one aged)? */
export function dueForRefresh(kind: QuoteKind, stored: StoredQuote | undefined, now: Date): boolean {
  if (!stored || !usable(stored.price)) return true;
  return now.getTime() - stored.fetchedAt.getTime() >= REFRESH_AFTER_MS[kind];
}

/**
 * The price to show: what the source just answered, else the last good
 * stored price (fresh while young enough), else nothing — never 0.
 */
export function resolveQuote(
  kind: QuoteKind,
  stored: StoredQuote | undefined,
  fetched: number | null | undefined,
  now: Date,
): Quote | null {
  if (usable(fetched)) return { price: fetched, fetchedAt: now, fresh: true };
  if (!stored || !usable(stored.price)) return null;
  return {
    price: stored.price,
    fetchedAt: stored.fetchedAt,
    fresh: now.getTime() - stored.fetchedAt.getTime() <= FRESH_FOR_MS[kind],
  };
}

export type Age = { unit: "now" } | { unit: "min" | "hour" | "day"; n: number };

/** A price's age in the unit a person would say it in. */
export function ageOf(fetchedAt: Date, now: Date): Age {
  const minutes = Math.floor(Math.max(0, now.getTime() - fetchedAt.getTime()) / 60_000);
  if (minutes < 1) return { unit: "now" };
  if (minutes < 60) return { unit: "min", n: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return { unit: "hour", n: hours };
  return { unit: "day", n: Math.floor(hours / 24) };
}
