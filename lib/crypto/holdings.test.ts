import { describe, expect, it } from "vitest";
import { removalShortfall, sellShortfall, summarize, value } from "./holdings";

describe("summarize", () => {
  it("weights the average buy price across multiple buys", () => {
    const s = summarize([
      { side: "buy", quantity: 1, unitPrice: 20000 },
      { side: "buy", quantity: 1, unitPrice: 30000 },
    ]);
    expect(s.quantity).toBe(2);
    expect(s.avgBuyPrice).toBe(25000);
    expect(s.costBasis).toBe(50000);
  });

  it("weights by quantity, not by trade count", () => {
    const s = summarize([
      { side: "buy", quantity: 3, unitPrice: 100 }, // 300
      { side: "buy", quantity: 1, unitPrice: 200 }, // 200
    ]);
    expect(s.avgBuyPrice).toBe(125); // 500 / 4
  });

  it("reduces quantity on sells but keeps the average buy price", () => {
    const s = summarize([
      { side: "buy", quantity: 2, unitPrice: 100 },
      { side: "sell", quantity: 1, unitPrice: 150 },
    ]);
    expect(s.quantity).toBe(1);
    expect(s.avgBuyPrice).toBe(100); // average cost method
    expect(s.costBasis).toBe(100);
    expect(s.totalSold).toBe(150);
  });

  it("never goes below zero holdings and reports what was oversold", () => {
    const s = summarize([
      { side: "buy", quantity: 1, unitPrice: 100 },
      { side: "sell", quantity: 5, unitPrice: 100 },
    ]);
    expect(s.quantity).toBe(0);
    expect(s.oversold).toBe(4);
    expect(s.totalSold).toBe(100); // only the unit that was held
  });

  it("uses the average cost at the time of a sell (buy, sell, buy again)", () => {
    // Audit case G: buy 2 @ 10,000, sell 1 @ 12,000, buy 1 @ 40,000.
    const v = value(
      [
        { side: "buy", quantity: 2, unitPrice: 10_000, tradedAt: "2026-01-01" },
        { side: "sell", quantity: 1, unitPrice: 12_000, tradedAt: "2026-02-01" },
        { side: "buy", quantity: 1, unitPrice: 40_000, tradedAt: "2026-03-01" },
      ],
      40_000,
    );
    expect(v.quantity).toBe(2);
    expect(v.avgBuyPrice).toBe(25_000);
    expect(v.costBasis).toBe(50_000);
    expect(v.profit).toBe(30_000);
    expect(v.realizedProfit).toBe(2_000);
  });

  it("starts from the new price after the position was closed", () => {
    const v = value(
      [
        { side: "buy", quantity: 1, unitPrice: 10_000, tradedAt: "2026-01-01" },
        { side: "sell", quantity: 1, unitPrice: 60_000, tradedAt: "2026-02-01" },
        { side: "buy", quantity: 1, unitPrice: 100_000, tradedAt: "2026-03-01" },
      ],
      100_000,
    );
    expect(v.avgBuyPrice).toBe(100_000);
    expect(v.profit).toBe(0); // bought today at today's price
    expect(v.realizedProfit).toBe(50_000);
  });

  it("replays in date order, not in the order the rows arrive", () => {
    const s = summarize([
      { side: "buy", quantity: 1, unitPrice: 40_000, tradedAt: new Date("2026-03-01") },
      { side: "sell", quantity: 1, unitPrice: 12_000, tradedAt: new Date("2026-02-01") },
      { side: "buy", quantity: 2, unitPrice: 10_000, tradedAt: new Date("2026-01-01") },
    ]);
    expect(s.avgBuyPrice).toBe(25_000);
    expect(s.quantity).toBe(2);
  });

  it("orders trades of the same day by entry time", () => {
    const day = "2026-05-01";
    const s = summarize([
      { side: "sell", quantity: 1, unitPrice: 150, tradedAt: day, createdAt: 2 },
      { side: "buy", quantity: 1, unitPrice: 100, tradedAt: day, createdAt: 1 },
    ]);
    expect(s.quantity).toBe(0);
    expect(s.oversold).toBe(0);
    expect(s.realizedProfit).toBe(50);
  });

  it("sells everything despite float dust", () => {
    const s = summarize([
      { side: "buy", quantity: 0.1, unitPrice: 100 },
      { side: "buy", quantity: 0.2, unitPrice: 100 },
      { side: "sell", quantity: 0.3, unitPrice: 100 },
    ]);
    expect(s.quantity).toBe(0);
    expect(s.costBasis).toBe(0);
    expect(s.oversold).toBe(0);
  });

  it("keeps a single satoshi", () => {
    const s = summarize([
      { side: "buy", quantity: 1, unitPrice: 100 },
      { side: "sell", quantity: 0.99999999, unitPrice: 100 },
    ]);
    expect(s.quantity).toBeCloseTo(1e-8, 12);
  });

  it("handles no trades", () => {
    const s = summarize([]);
    expect(s.quantity).toBe(0);
    expect(s.avgBuyPrice).toBe(0);
    expect(s.costBasis).toBe(0);
  });
});

describe("value", () => {
  const trades = [
    { side: "buy" as const, quantity: 0.5, unitPrice: 20000 }, // cost 10000
    { side: "buy" as const, quantity: 0.5, unitPrice: 30000 }, // cost 15000
  ]; // qty 1, avg 25000, basis 25000

  it("computes current value and profit at the live price", () => {
    const v = value(trades, 40000);
    expect(v.currentValue).toBe(40000);
    expect(v.profit).toBe(15000);
    expect(v.profitPct).toBeCloseTo(0.6, 6); // 15000 / 25000
  });

  it("shows a loss when the price drops", () => {
    const v = value(trades, 20000);
    expect(v.currentValue).toBe(20000);
    expect(v.profit).toBe(-5000);
    expect(v.profitPct).toBeCloseTo(-0.2, 6);
  });

  it("returns nulls when no live price is available", () => {
    const v = value(trades, null);
    expect(v.currentValue).toBeNull();
    expect(v.profit).toBeNull();
    expect(v.profitPct).toBeNull();
    expect(v.quantity).toBe(1); // summary still computed
  });
});

describe("sellShortfall", () => {
  const record = [
    { side: "buy" as const, quantity: 2, unitPrice: 100, tradedAt: "2026-01-10" },
    { side: "sell" as const, quantity: 1, unitPrice: 120, tradedAt: "2026-02-10" },
  ];

  it("accepts a sell of what is held", () => {
    expect(sellShortfall(record, { side: "sell", quantity: 1, unitPrice: 130, tradedAt: "2026-03-01" })).toBeNull();
  });

  it("rejects selling more than is held", () => {
    expect(
      sellShortfall(record, { side: "sell", quantity: 1.5, unitPrice: 130, tradedAt: "2026-03-01" }),
    ).toEqual({ held: 1 });
  });

  it("rejects a sell dated before the buy", () => {
    expect(
      sellShortfall(record, { side: "sell", quantity: 1, unitPrice: 130, tradedAt: "2026-01-01" }),
    ).toEqual({ held: 0 });
  });

  it("rejects a back-dated sell that leaves a later sell uncovered — and names that later sell", () => {
    // Held 2 on 15 Jan; selling 2 then leaves the 10 Feb sell with nothing.
    const short = sellShortfall(record, { side: "sell", quantity: 2, unitPrice: 130, tradedAt: "2026-01-15" });
    expect(short?.held).toBe(0);
    expect(short?.later?.tradedAt).toBe("2026-02-10");
  });

  it("never blocks a buy", () => {
    expect(sellShortfall([], { side: "buy", quantity: 1, unitPrice: 1 })).toBeNull();
  });
});

describe("removalShortfall", () => {
  const record = [
    { side: "buy" as const, quantity: 1, unitPrice: 100, tradedAt: "2026-01-10" },
    { side: "buy" as const, quantity: 1, unitPrice: 100, tradedAt: "2026-01-20" },
    { side: "sell" as const, quantity: 2, unitPrice: 120, tradedAt: "2026-02-10" },
  ];

  it("blocks deleting a buy a later sell depends on", () => {
    expect(removalShortfall(record, 0)).toEqual({ held: 1 });
  });

  it("allows deleting the sell", () => {
    expect(removalShortfall(record, 2)).toBeNull();
  });

  it("never blocks cleaning up a record that is already inconsistent", () => {
    const broken = [
      { side: "buy" as const, quantity: 1, unitPrice: 100 },
      { side: "sell" as const, quantity: 3, unitPrice: 100 },
    ];
    expect(removalShortfall(broken, 0)).toBeNull();
  });
});
