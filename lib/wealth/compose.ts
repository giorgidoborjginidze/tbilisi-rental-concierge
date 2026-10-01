// What the owner is worth: the estimated value of what they physically own
// plus every coin, share and ounce of metal, in GEL. Pure — the prices and
// the rate come in (lib/prices/quotes.ts); lib/wealth/net-worth.ts loads.
//
// A holding is valued at its price when one is known (live, or the last
// known one), else at what was paid for it — never at 0. Anything that is
// not a live price makes the total approximate, and says so.

import { value, type CryptoTradeLike, type Valuation } from "@/lib/crypto/holdings";
import { quoteKey, type FxRate, type Quote } from "@/lib/prices/freshness";

export const HOLDING_KINDS = ["crypto", "stock", "metal"] as const;
export type HoldingKind = (typeof HOLDING_KINDS)[number];

export const isHolding = (category: string): category is HoldingKind =>
  (HOLDING_KINDS as readonly string[]).includes(category);

/** Physical categories as the ring groups them. */
export const PHYSICAL_GROUPS = ["real_estate", "vehicle", "income_source", "other"] as const;
export type PhysicalGroup = (typeof PHYSICAL_GROUPS)[number];

export const physicalGroup = (category: string): PhysicalGroup =>
  category === "real_estate" || category === "vehicle" || category === "income_source"
    ? category
    : "other";

export interface WealthAsset {
  id: string;
  name: string;
  nameKa: string | null;
  category: string;
  symbol: string | null;
  coingeckoId: string | null;
  estimatedValue: number | null;
  trades: CryptoTradeLike[];
}

/** How a holding's value was reached. */
export type ValueBasis = "live" | "stale" | "cost";

export interface HoldingLine {
  id: string;
  name: string;
  nameKa: string | null;
  symbol: string | null;
  kind: HoldingKind;
  /** USD figures at the known price (currentPrice null when none). */
  valuation: Valuation;
  quote: Quote | null;
  basis: ValueBasis;
  /** What it counts for in the totals (USD): at its price, else at cost. */
  valueUsd: number;
  valueGel: number;
}

export interface NetWorth {
  /** Σ estimated value of everything that is not a holding (GEL). */
  physical: number;
  physicalByGroup: Record<PhysicalGroup, number>;
  /** Σ holdings (GEL, at the rate below). */
  holdings: number;
  holdingsUsd: number;
  byKind: Record<HoldingKind, { usd: number; gel: number; count: number }>;
  total: number;
  /** The weakest basis among the holdings still held; "none" without any. */
  holdingsBasis: "none" | ValueBasis;
  /** True when any holding is not at a live price, or the rate is not the NBG's. */
  approximate: boolean;
  /** Oldest price shown as "last known" (for "prices from 3 h ago"). */
  oldestStaleAt: Date | null;
  rate: FxRate;
  lines: HoldingLine[];
  /** A property value in dollars or euros was counted in lari at the NBG rate. */
  converted?: boolean;
}

const BASIS_RANK: Record<ValueBasis, number> = { live: 0, stale: 1, cost: 2 };

export function holdingQuoteKey(asset: Pick<WealthAsset, "category" | "symbol" | "coingeckoId">): string | null {
  if (asset.category === "crypto") return asset.coingeckoId ? quoteKey("crypto", asset.coingeckoId) : null;
  if (asset.category === "stock" || asset.category === "metal") {
    return asset.symbol ? quoteKey(asset.category, asset.symbol) : null;
  }
  return null;
}

export function composeNetWorth(
  assets: WealthAsset[],
  quotes: Map<string, Quote>,
  rate: FxRate,
): NetWorth {
  const physicalByGroup: Record<PhysicalGroup, number> = {
    real_estate: 0,
    vehicle: 0,
    income_source: 0,
    other: 0,
  };
  const byKind: NetWorth["byKind"] = {
    crypto: { usd: 0, gel: 0, count: 0 },
    stock: { usd: 0, gel: 0, count: 0 },
    metal: { usd: 0, gel: 0, count: 0 },
  };
  const lines: HoldingLine[] = [];
  let worst: NetWorth["holdingsBasis"] = "none";
  let oldestStaleAt: Date | null = null;

  for (const asset of assets) {
    if (!isHolding(asset.category)) {
      physicalByGroup[physicalGroup(asset.category)] += Math.max(0, asset.estimatedValue ?? 0);
      continue;
    }
    const key = holdingQuoteKey(asset);
    const quote = key ? quotes.get(key) ?? null : null;
    const valuation = value(asset.trades, quote?.price ?? null);
    const basis: ValueBasis = !quote ? "cost" : quote.fresh ? "live" : "stale";
    const valueUsd = valuation.currentValue ?? valuation.costBasis;
    const line: HoldingLine = {
      id: asset.id,
      name: asset.name,
      nameKa: asset.nameKa,
      symbol: asset.symbol,
      kind: asset.category,
      valuation,
      quote,
      basis,
      valueUsd,
      valueGel: valueUsd * rate.value,
    };
    lines.push(line);
    byKind[asset.category].usd += valueUsd;
    byKind[asset.category].gel += line.valueGel;
    byKind[asset.category].count += 1;

    // Only what is still held shapes the label: a closed position's
    // missing price changes no total.
    if (valuation.quantity > 0) {
      if (worst === "none" || BASIS_RANK[basis] > BASIS_RANK[worst]) worst = basis;
      if (basis === "stale" && quote && (!oldestStaleAt || quote.fetchedAt < oldestStaleAt)) {
        oldestStaleAt = quote.fetchedAt;
      }
    }
  }

  const physical = PHYSICAL_GROUPS.reduce((sum, group) => sum + physicalByGroup[group], 0);
  const holdingsUsd = HOLDING_KINDS.reduce((sum, kind) => sum + byKind[kind].usd, 0);
  const holdings = HOLDING_KINDS.reduce((sum, kind) => sum + byKind[kind].gel, 0);
  const holdsAny = worst !== "none";
  return {
    physical,
    physicalByGroup,
    holdings,
    holdingsUsd,
    byKind,
    total: physical + holdings,
    holdingsBasis: worst,
    approximate: holdsAny && (worst !== "live" || rate.state !== "live"),
    oldestStaleAt,
    rate,
    lines,
  };
}
