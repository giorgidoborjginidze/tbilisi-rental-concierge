import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as { key: string; price: number; fetchedAt: Date; source: string }[],
  background: [] as (() => Promise<unknown>)[],
  asked: [] as string[][],
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceQuote: {
      findMany: async () => state.rows,
      upsert: async () => null,
    },
  },
}));
vi.mock("./background", () => ({
  inBackground: (task: () => Promise<unknown>) => state.background.push(task),
  inBackgroundOnce: (_key: string, task: () => Promise<unknown>) => state.background.push(task),
}));
vi.mock("@/lib/crypto/prices", () => ({
  FALLBACK_USD_GEL: 2.7,
  fetchUsdGelRate: async () => 2.65,
  fetchUsdPrices: async (ids: string[]) => {
    state.asked.push(ids);
    return Object.fromEntries(ids.map((id) => [id, 100]));
  },
}));
vi.mock("@/lib/stocks/prices", () => ({ fetchStockPrices: async () => ({}) }));
vi.mock("@/lib/metals/prices", () => ({ fetchMetalPrices: async () => ({}) }));

import { loadQuotes } from "./quotes";

const now = new Date("2026-10-01T10:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

beforeEach(() => {
  state.rows = [];
  state.background = [];
  state.asked = [];
});

describe("loadQuotes never makes a page wait for a price it knows", () => {
  it("uses a known but due price at once and refreshes it after the page", async () => {
    state.rows = [
      { key: "crypto:bitcoin", price: 90, fetchedAt: ago(10), source: "coingecko" },
      { key: "fx:USDGEL", price: 2.7, fetchedAt: ago(5), source: "nbg" },
    ];
    const { quotes } = await loadQuotes([{ kind: "crypto", id: "bitcoin" }], now);
    expect(quotes.get("crypto:bitcoin")?.price).toBe(90);
    expect(state.asked).toEqual([]);
    expect(state.background).toHaveLength(1);
    await state.background[0]();
    expect(state.asked).toEqual([["bitcoin"]]);
  });

  it("waits only for a price never seen before", async () => {
    state.rows = [{ key: "fx:USDGEL", price: 2.7, fetchedAt: ago(5), source: "nbg" }];
    const { quotes } = await loadQuotes([{ kind: "crypto", id: "ethereum" }], now);
    expect(quotes.get("crypto:ethereum")?.price).toBe(100);
    expect(state.background).toHaveLength(0);
  });
});
