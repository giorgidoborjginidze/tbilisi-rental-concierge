import { describe, expect, it } from "vitest";
import { composeNetWorth, type WealthAsset } from "./compose";
import type { FxRate, Quote } from "@/lib/prices/freshness";

const now = new Date("2026-09-30T12:00:00Z");
const live: FxRate = { value: 2.7, fetchedAt: now, state: "live" };

const flat: WealthAsset = {
  id: "f", name: "Flat", nameKa: null, category: "real_estate", symbol: null, coingeckoId: null,
  estimatedValue: 300_000, trades: [],
};
const car: WealthAsset = { ...flat, id: "c", name: "Car", category: "vehicle", estimatedValue: 35_000 };
const btc: WealthAsset = {
  id: "b", name: "Bitcoin", nameKa: null, category: "crypto", symbol: "BTC", coingeckoId: "bitcoin",
  estimatedValue: null,
  trades: [{ side: "buy", quantity: 0.15, unitPrice: 40_000 }], // cost 6,000 $
};
const aapl: WealthAsset = {
  id: "a", name: "Apple", nameKa: null, category: "stock", symbol: "AAPL", coingeckoId: null,
  estimatedValue: null,
  trades: [{ side: "buy", quantity: 10, unitPrice: 200 }], // cost 2,000 $
};

const q = (price: number, fresh = true, fetchedAt = now): Quote => ({ price, fresh, fetchedAt });

describe("composeNetWorth", () => {
  it("counts holdings in the total, in GEL at the rate", () => {
    const quotes = new Map([["crypto:bitcoin", q(64_000)], ["stock:AAPL", q(230)]]);
    const worth = composeNetWorth([flat, car, btc, aapl], quotes, live);
    expect(worth.physical).toBe(335_000);
    expect(worth.holdingsUsd).toBeCloseTo(0.15 * 64_000 + 10 * 230, 6);
    expect(worth.holdings).toBeCloseTo((9_600 + 2_300) * 2.7, 6);
    expect(worth.total).toBeCloseTo(335_000 + 11_900 * 2.7, 6);
    expect(worth.approximate).toBe(false);
    expect(worth.holdingsBasis).toBe("live");
    expect(worth.byKind.crypto.count).toBe(1);
    expect(worth.physicalByGroup.real_estate).toBe(300_000);
  });

  it("values a holding without any price at what was paid, never 0, and says it is approximate", () => {
    const worth = composeNetWorth([flat, btc], new Map(), live);
    const line = worth.lines[0];
    expect(line.basis).toBe("cost");
    expect(line.valueUsd).toBe(6_000);
    expect(line.valuation.profit).toBeNull();
    expect(worth.total).toBeCloseTo(300_000 + 6_000 * 2.7, 6);
    expect(worth.approximate).toBe(true);
    expect(worth.holdingsBasis).toBe("cost");
  });

  it("uses the last known price and remembers the oldest one", () => {
    const old = new Date("2026-09-30T09:00:00Z");
    const quotes = new Map([["crypto:bitcoin", q(60_000, false, old)], ["stock:AAPL", q(230)]]);
    const worth = composeNetWorth([btc, aapl], quotes, live);
    expect(worth.lines.find((line) => line.id === "b")?.basis).toBe("stale");
    expect(worth.holdingsBasis).toBe("stale");
    expect(worth.approximate).toBe(true);
    expect(worth.oldestStaleAt).toEqual(old);
  });

  it("is approximate when the rate is not the NBG's", () => {
    const quotes = new Map([["crypto:bitcoin", q(64_000)]]);
    const worth = composeNetWorth([btc], quotes, { value: 2.72, fetchedAt: null, state: "fallback" });
    expect(worth.approximate).toBe(true);
  });

  it("ignores a closed position's missing price", () => {
    const sold: WealthAsset = {
      ...btc,
      trades: [
        { side: "buy", quantity: 1, unitPrice: 10 },
        { side: "sell", quantity: 1, unitPrice: 20 },
      ],
    };
    const worth = composeNetWorth([flat, sold], new Map(), live);
    expect(worth.approximate).toBe(false);
    expect(worth.holdingsBasis).toBe("none");
    expect(worth.holdings).toBe(0);
  });

  it("without holdings is just the physical value", () => {
    const worth = composeNetWorth([flat, car], new Map(), { value: 0, fetchedAt: null, state: "live" });
    expect(worth.total).toBe(335_000);
    expect(worth.approximate).toBe(false);
  });
});
