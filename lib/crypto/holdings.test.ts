import { describe, expect, it } from "vitest";
import { summarize, value } from "./holdings";

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

  it("never goes below zero holdings", () => {
    const s = summarize([
      { side: "buy", quantity: 1, unitPrice: 100 },
      { side: "sell", quantity: 5, unitPrice: 100 },
    ]);
    expect(s.quantity).toBe(0);
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
