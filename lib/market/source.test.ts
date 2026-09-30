import { describe, expect, it } from "vitest";
import { MockMarketDataSource } from "./source";

describe("market benchmarks by canonical district", () => {
  it("finds the Vake benchmark for a district typed as ვაკე", async () => {
    const source = new MockMarketDataSource([
      { district: "Vake", month: "2026-09", adr: 190, occupancyRate: 0.7, sampleSize: 40, source: "estimate" },
    ]);
    expect((await source.getBenchmark("ვაკე", "2026-09"))?.adr).toBe(190);
    expect((await source.getBenchmark("Vake", "2026-09"))?.adr).toBe(190);
    expect(await source.getBenchmark("დიდუბე", "2026-09")).toBeNull();
  });
});
