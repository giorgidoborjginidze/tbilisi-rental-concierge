import { describe, expect, it } from "vitest";
import { aggregateMetrics, type WindowMetrics } from "./metrics";
import { portfolioCurrency, scaledMetrics } from "./portfolio";

const m = (revenue: number, nights: number): WindowMetrics => ({
  availableNights: 30,
  leasedNights: 0,
  occupiedNights: nights,
  bookedNights: nights,
  unpricedNights: 0,
  revenue,
  occupancyRate: nights / 30,
  adr: nights ? revenue / nights : null,
  revpar: revenue / 30,
});

describe("portfolio across currencies", () => {
  it("keeps one shared currency as entered", () => {
    expect(portfolioCurrency([{ currency: "USD" }, { currency: "usd" }])).toEqual({ currency: "USD", mixed: false });
    expect(portfolioCurrency([])).toEqual({ currency: "GEL", mixed: false });
  });

  it("adds dollars and lari up in lari", () => {
    expect(portfolioCurrency([{ currency: "USD" }, { currency: "GEL" }])).toEqual({ currency: "GEL", mixed: true });
    // $100 for 2 nights at 2.7 ₾ + 150 ₾ for 3 nights.
    const total = aggregateMetrics([scaledMetrics(m(100, 2), 2.7), scaledMetrics(m(150, 3), 1)]);
    expect(total.revenue).toBeCloseTo(420);
    expect(total.adr).toBeCloseTo(84);
    expect(total.occupancyRate).toBeCloseTo(5 / 60);
  });

  it("never converts nights or a missing price", () => {
    const none = scaledMetrics({ ...m(0, 0), adr: null }, 2.7);
    expect(none.adr).toBeNull();
    expect(none.bookedNights).toBe(0);
  });
});
