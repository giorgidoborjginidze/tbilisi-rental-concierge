import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { inPlaceCurrency, type RentalPlace } from "./places";
import { emptySources, placeMetrics } from "./stays";

const rates = { USD: 2.7, EUR: 3 };
const july = { start: new Date("2026-07-01T00:00:00Z"), end: new Date("2026-08-01T00:00:00Z") };

const place = (over: Partial<RentalPlace["sources"]>, currency = "GEL"): RentalPlace => ({
  key: "u1",
  unit: null,
  asset: { id: "a1", name: "Vake", nameKa: null, rentalMode: "daily", dailyRate: 100, currency: "USD" },
  name: "Vake",
  nameKa: null,
  city: "Tbilisi",
  district: "Vake",
  currency,
  sources: { ...emptySources(), dailyMode: true, ...over },
});

describe("one currency per place", () => {
  it("counts a dollar contract on a lari unit in lari, marked converted", () => {
    const contract = {
      id: "c1",
      startDate: new Date("2026-07-01T00:00:00Z"),
      endDate: new Date("2026-07-03T00:00:00Z"),
      paymentPeriod: "daily",
      paymentAmount: 50,
      monthlyRent: 1500,
      currency: "USD",
    };
    const out = inPlaceCurrency(place({ contracts: [contract] }), "USD", rates);
    expect(out.converted).toBe(true);
    const [converted] = out.sources.contracts;
    expect(converted.currency).toBe("GEL");
    expect(converted.paymentAmount).toBeCloseTo(135);
    expect(converted.monthlyRent).toBeCloseTo(4050);
    expect(placeMetrics(out.sources, july).revenue).toBeCloseTo(270);
  });

  it("converts the linked asset's daily answers to the unit's currency", () => {
    const out = inPlaceCurrency(place({ days: [{ date: new Date("2026-07-05T00:00:00Z"), amount: 40 }] }), "USD", rates);
    expect(out.sources.days[0].amount).toBeCloseTo(108);
  });

  it("leaves a place in one currency untouched", () => {
    const same = place({ days: [{ date: new Date("2026-07-05T00:00:00Z"), amount: 40 }] }, "USD");
    expect(inPlaceCurrency(same, "USD", rates)).toBe(same);
  });
});

describe("bookings in another currency", () => {
  it("are counted in the place's currency and mark it converted", () => {
    const booking = {
      id: "b1", source: "manual", nights: 2, amount: 300, currency: "GEL",
      checkIn: new Date("2026-07-10T00:00:00Z"), checkOut: new Date("2026-07-12T00:00:00Z"),
    };
    const out = inPlaceCurrency(place({ bookings: [booking] }, "USD"), "USD", rates);
    expect(out.converted).toBe(true);
    expect(out.sources.bookings[0].amount).toBeCloseTo(300 / 2.7);
    expect(out.sources.bookings[0].currency).toBe("USD");
  });
});
