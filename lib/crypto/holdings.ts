// Pure holdings math for coins, shares and precious metals — no framework,
// no I/O. Prices are in the holding's quote currency (USD by convention);
// the caller converts to GEL for the portfolio total.
//
// Average-cost method: the trades are replayed in the order they happened.
// A buy adds its quantity and cost; a sell takes quantity out at the
// CURRENT average cost (the average does not move) and books the
// difference to the sale price as realized profit. When the position
// reaches zero the cost resets, so a coin bought again later starts from
// its new price — a profit taken in the past never inflates today's P/L.

export type TradeSide = "buy" | "sell";

export interface CryptoTradeLike {
  side: TradeSide;
  quantity: number; // coins / shares / troy ounces
  unitPrice: number; // price per unit at the trade (USD)
  /** When the trade happened; trades are replayed in this order. */
  tradedAt?: Date | string | number | null;
  /** When it was entered: breaks ties between trades of the same day. */
  createdAt?: Date | string | number | null;
}

export interface HoldingsSummary {
  /** Units held after every trade (never below 0). */
  quantity: number;
  /** Average cost of the units still held (USD); 0 when none are held. */
  avgBuyPrice: number;
  /** Cost of the units still held: quantity × avgBuyPrice (USD). */
  costBasis: number;
  /** Profit booked by sells: Σ sold × (sale price − average cost then). */
  realizedProfit: number;
  /** Total spent on buys and received from sells (USD). */
  totalBought: number;
  totalSold: number;
  /**
   * Units sold beyond what was held at the time (older data entered before
   * sells were checked). Left out of the maths; > 0 means the record needs
   * a look.
   */
  oversold: number;
}

const time = (value: CryptoTradeLike["tradedAt"]): number => {
  if (value == null) return 0;
  const at = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(at) ? at : 0;
};

/** Trades in the order they happened (then in the order they were entered). */
export function chronological<T extends CryptoTradeLike>(trades: T[]): T[] {
  return trades
    .map((trade, index) => ({ trade, index }))
    .sort(
      (a, b) =>
        time(a.trade.tradedAt) - time(b.trade.tradedAt) ||
        time(a.trade.createdAt) - time(b.trade.createdAt) ||
        a.index - b.index,
    )
    .map(({ trade }) => trade);
}

// Float dust (0.1 + 0.2 − 0.3) must neither block a sell of "everything"
// nor leave a phantom position; relative, so a single satoshi still counts.
const tolerance = (held: number) => Math.max(held * 1e-9, 1e-12);

export function summarize(trades: CryptoTradeLike[]): HoldingsSummary {
  let quantity = 0;
  let cost = 0;
  let realizedProfit = 0;
  let totalBought = 0;
  let totalSold = 0;
  let oversold = 0;

  for (const trade of chronological(trades)) {
    const q = Math.max(0, trade.quantity);
    const p = Math.max(0, trade.unitPrice);
    if (q === 0) continue;
    if (trade.side === "buy") {
      quantity += q;
      cost += q * p;
      totalBought += q * p;
      continue;
    }
    const sold = Math.min(q, quantity);
    if (q - quantity > tolerance(quantity)) oversold += q - quantity;
    const avg = quantity > 0 ? cost / quantity : 0;
    realizedProfit += sold * (p - avg);
    totalSold += sold * p;
    quantity -= sold;
    cost -= sold * avg;
    if (quantity <= tolerance(sold)) {
      quantity = 0;
      cost = 0;
    }
  }

  const avgBuyPrice = quantity > 0 ? cost / quantity : 0;
  return {
    quantity,
    avgBuyPrice,
    costBasis: quantity > 0 ? cost : 0,
    realizedProfit,
    totalBought,
    totalSold,
    oversold,
  };
}

/**
 * Would adding `next` sell more than is held at its date — counting every
 * trade before AND after it (a back-dated sell must not break a later one)?
 * Returns the units that were held at the worst point, or null when the
 * record stays consistent.
 */
export function sellShortfall(
  trades: CryptoTradeLike[],
  next: CryptoTradeLike,
): { held: number } | null {
  const withNext = chronological([
    ...trades,
    { ...next, createdAt: next.createdAt ?? Number.MAX_SAFE_INTEGER },
  ]);
  return firstShortfall(withNext);
}

/**
 * Would removing trade `index` (of `trades`) leave a later sell with more
 * than is held? Returns what was held at the first such sell, or null.
 */
export function removalShortfall(
  trades: CryptoTradeLike[],
  index: number,
): { held: number } | null {
  const before = firstShortfall(chronological(trades));
  if (before) return null; // already inconsistent; never block a clean-up
  return firstShortfall(chronological(trades.filter((_, i) => i !== index)));
}

function firstShortfall(ordered: CryptoTradeLike[]): { held: number } | null {
  let held = 0;
  for (const trade of ordered) {
    const q = Math.max(0, trade.quantity);
    if (trade.side === "buy") {
      held += q;
      continue;
    }
    if (q - held > tolerance(held)) return { held };
    held = Math.max(0, held - q);
    if (held <= tolerance(q)) held = 0;
  }
  return null;
}

export interface Valuation extends HoldingsSummary {
  currentPrice: number | null;
  /** quantity × currentPrice (USD); null when no price is known. */
  currentValue: number | null;
  /** Unrealized: currentValue − costBasis (USD); null when no price. */
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
