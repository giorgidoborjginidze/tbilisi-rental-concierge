// A buy or sell of a holding (crypto, shares, precious metal) as the owner
// types it — on the holding's page, and as the first purchase on the "add
// asset" form, so a new holding is one screen, not two. Metals are stored
// in troy ounces (the unit their live price is quoted in); the owner may
// type grams — a 10 g bar — and the price per gram, converted here.
// Pure; no database.

import type { StringKey } from "@/lib/i18n/strings";

/** Grams in one troy ounce. */
export const TROY_OUNCE_GRAMS = 31.1034768;

export type MetalUnit = "oz" | "g";

export const asMetalUnit = (value: string | null | undefined): MetalUnit =>
  value === "g" ? "g" : "oz";

export interface TradeInput {
  side: "buy" | "sell";
  /** Coins, shares or troy ounces. */
  quantity: number;
  /** USD per coin / share / troy ounce. */
  unitPrice: number;
  tradedAt: Date;
}

const dateOf = (raw: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Parse a trade. `unit` applies to metals only ("g": quantity in grams,
 * price per gram). An empty date is today. With `optional`, a form where
 * quantity and price are both empty is "no trade" (null) — the first
 * purchase on the add-asset form may be left for later.
 */
export function parseTradeInput(
  get: (key: string) => string,
  opts: { metal: boolean; today: Date; optional?: boolean },
): { error: StringKey } | { value: TradeInput | null } {
  const quantityRaw = get("quantity");
  const priceRaw = get("unitPrice");
  if (opts.optional && !quantityRaw && !priceRaw) return { value: null };
  if (!quantityRaw || !priceRaw) return { error: "error_required" };

  const quantity = Number(quantityRaw);
  const price = Number(priceRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "error_invalid_number" };
  if (!Number.isFinite(price) || price < 0) return { error: "error_invalid_number" };

  const dateRaw = get("tradedAt");
  const tradedAt = dateRaw ? dateOf(dateRaw) : opts.today;
  if (!tradedAt) return { error: "error_required" };

  const grams = opts.metal && asMetalUnit(get("unit")) === "g";
  return {
    value: {
      side: get("side") === "sell" ? "sell" : "buy",
      quantity: grams ? quantity / TROY_OUNCE_GRAMS : quantity,
      unitPrice: grams ? price * TROY_OUNCE_GRAMS : price,
      tradedAt,
    },
  };
}
