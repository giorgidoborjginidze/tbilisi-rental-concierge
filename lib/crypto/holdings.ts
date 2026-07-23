// Pure crypto-holdings math — no framework, no I/O. Prices are in the
// coin's quote currency (USD by convention); the caller converts to GEL
// for the portfolio total.

export type TradeSide = "buy" | "sell";

export interface CryptoTradeLike {
  side: TradeSide;
  quantity: number; // coins
  unitPrice: number; // price per coin at the trade (USD)
}

export interface HoldingsSummary {
  /** Coins currently held: bought − sold (never below 0). */
  quantity: number;
  /** Weighted average buy price across all buys (USD). */
  avgBuyPrice: number;
  /** Cost basis of the coins still held: quantity × avgBuyPrice (USD). */
  costBasis: number;
  /** Total spent on buys and received from sells (USD). */
  totalBought: number;
  totalSold: number;
}

export function summarize(trades: CryptoTradeLike[]): HoldingsSummary {
  let boughtQty = 0;
  let boughtCost = 0;
  let soldQty = 0;
  let soldValue = 0;
  for (const t of trades) {
    const q = Math.max(0, t.quantity);
    const p = Math.max(0, t.unitPrice);
    if (t.side === "buy") {
      boughtQty += q;
      boughtCost += q * p;
    } else {
      soldQty += q;
      soldValue += q * p;
    }
  }
  const quantity = Math.max(0, boughtQty - soldQty);
  const avgBuyPrice = boughtQty > 0 ? boughtCost / boughtQty : 0;
  return {
    quantity,
    avgBuyPrice,
    costBasis: quantity * avgBuyPrice,
    totalBought: boughtCost,
    totalSold: soldValue,
  };
}

export interface Valuation extends HoldingsSummary {
  currentPrice: number | null;
  /** quantity × currentPrice (USD); null when no live price. */
  currentValue: number | null;
  /** currentValue − costBasis (USD); null when no live price. */
  profit: number | null;
  /** profit / costBasis as a fraction; null when no basis or price. */
  profitPct: number | null;
}

export function value(
  trades: CryptoTradeLike[],
  currentPrice: number | null,
): Valuation {
  const s = summarize(trades);
  const currentValue = currentPrice == null ? null : s.quantity * currentPrice;
  const profit = currentValue == null ? null : currentValue - s.costBasis;
  const profitPct =
    profit == null || s.costBasis <= 0 ? null : profit / s.costBasis;
  return { ...s, currentPrice, currentValue, profit, profitPct };
}
