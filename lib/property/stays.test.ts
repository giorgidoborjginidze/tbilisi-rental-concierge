import { describe, expect, it } from "vitest";
import {
  dayFills,
  emptySources,
  nightOwners,
  nightsToAnswer,
  occupiedIntervals,
  placeMetrics,
  placeStays,
  stayOn,
  type PlaceSources,
} from "./stays";
import { unitWindowMetrics } from "@/lib/analytics/metrics";
import { incomeInWindow } from "@/lib/analytics/income";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const september = { start: d("2026-09-01"), end: d("2026-10-01") };

const src = (over: Partial<PlaceSources>): PlaceSources => ({ ...emptySources(), ...over });

describe("one source per night", () => {
  it("a daily answer on a night a booking holds is neither drawn nor counted again", () => {
    const place = src({
      dailyMode: true,
      bookings: [
        { id: "b1", source: "airbnb", checkIn: d("2026-09-29"), checkOut: d("2026-10-01"), nights: 2, amount: 360 },
      ],
      // The owner also answered "rented, 180" on the dashboard for the 30th.
      days: [{ date: d("2026-09-30"), amount: 180 }],
    });
    expect(dayFills(place)).toEqual([]);
    const metrics = placeMetrics(place, september);
    expect(metrics.revenue).toBe(360);
    expect(metrics.bookedNights).toBe(2);
    expect(metrics.occupiedNights).toBe(2);
  });

  it("the September bar and the KPI agree: a one-night contract plus the same day's answer is 180, not 360", () => {
    // persona-landlord-03: the night marked on the asset calendar (a
    // contract, before this package) and answered on the dashboard.
    const place = src({
      dailyMode: true,
      contracts: [
        {
          id: "c1",
          startDate: d("2026-09-30"),
          endDate: d("2026-10-01"),
          paymentPeriod: "daily",
          paymentAmount: 180,
          monthlyRent: 180 * 30.44,
        },
      ],
      days: [{ date: d("2026-09-30"), amount: 180 }],
    });
    const metrics = placeMetrics(place, september);
    expect(metrics.revenue).toBe(180);
    expect(metrics.bookedNights).toBe(1);
    expect(stayOn(place, d("2026-09-30"))?.record).toBe("contract");
    expect(nightOwners(place, september).get(d("2026-09-30").getTime())?.record).toBe("contract");

    // The same place counted by the income module gives the same money.
    const income = incomeInWindow(
      {
        assets: [
          {
            id: "a1", unitId: null, category: "real_estate", rentalMode: "daily",
            monthlyIncome: null, createdAt: d("2026-01-01"), weekendPct: 0, holidayPct: 0,
          },
        ],
        contracts: place.contracts.map((c) => ({ ...c, assetId: "a1" })),
        leases: [],
        bookings: [],
        dayEntries: place.days.map((day) => ({ ...day, assetId: "a1" })),
        records: [],
      },
      september,
    );
    expect(income.daily).toBe(metrics.revenue);
  });

  it("daily answers fill free nights and count once", () => {
    const place = src({
      dailyMode: true,
      days: [
        { date: d("2026-09-10"), amount: 100 },
        { date: d("2026-09-11"), amount: 120 },
      ],
    });
    const fills = dayFills(place);
    expect(fills.map((f) => f.start)).toEqual([d("2026-09-10"), d("2026-09-11")]);
    const metrics = placeMetrics(place, september);
    expect(metrics.revenue).toBe(220);
    expect(metrics.occupiedNights).toBe(2);
    expect(metrics.adr).toBe(110);
  });

  it("a priced booking wins over a day-let contract on the same night; revenue once", () => {
    const place = src({
      dailyMode: true,
      bookings: [
        { id: "b1", source: "booking", checkIn: d("2026-09-05"), checkOut: d("2026-09-06"), nights: 1, amount: 200 },
      ],
      contracts: [
        {
          id: "c1",
          startDate: d("2026-09-04"),
          endDate: d("2026-09-07"),
          paymentPeriod: "daily",
          paymentAmount: 50,
          monthlyRent: 1522,
        },
      ],
    });
    const metrics = placeMetrics(place, september);
    // 4th and 6th from the contract (50 each), the 5th from the booking.
    expect(metrics.revenue).toBe(300);
    expect(metrics.bookedNights).toBe(3);
    expect(metrics.occupiedNights).toBe(3);
    // Both are stays: the calendar still shows the clash on the 5th.
    expect(placeStays(place).map((s) => s.kind)).toEqual(["booking", "contract"]);
  });

  it("a daily answer prices a night an unpriced import holds, without selling it twice", () => {
    const place = src({
      dailyMode: true,
      bookings: [
        { id: "b1", source: "airbnb", checkIn: d("2026-09-20"), checkOut: d("2026-09-22"), nights: 2, amount: null },
      ],
      days: [{ date: d("2026-09-20"), amount: 150 }],
    });
    const metrics = placeMetrics(place, september);
    expect(metrics.revenue).toBe(150);
    expect(metrics.bookedNights).toBe(2);
    expect(metrics.unpricedNights).toBe(1);
    expect(metrics.occupiedNights).toBe(2);
  });

  it("a long contract on a linked asset is leased time, like a Lease", () => {
    const place = src({
      dailyMode: false,
      contracts: [
        {
          id: "c1",
          startDate: d("2026-09-16"),
          endDate: d("2027-03-16"),
          paymentPeriod: "monthly",
          paymentAmount: 1200,
          monthlyRent: 1200,
        },
      ],
    });
    expect(placeStays(place)[0]).toMatchObject({ kind: "lease", role: "lease" });
    const metrics = placeMetrics(place, september);
    expect(metrics.leasedNights).toBe(15);
    expect(metrics.availableNights).toBe(15);
    expect(metrics.revenue).toBe(0); // rent is "rent" income, not nightly revenue
  });

  it("with bookings and leases only, it is exactly the unit metrics", () => {
    const bookings = [
      { id: "b1", source: "airbnb", checkIn: d("2026-08-30"), checkOut: d("2026-09-03"), nights: 4, amount: 400 },
      { id: "b2", source: "booking", checkIn: d("2026-09-10"), checkOut: d("2026-09-12"), nights: 2, amount: null },
      // A double booking: both stays keep their revenue.
      { id: "b3", source: "direct", checkIn: d("2026-09-10"), checkOut: d("2026-09-11"), nights: 1, amount: 90 },
    ];
    const leases = [{ id: "l1", startDate: d("2026-09-20"), endDate: d("2026-10-20") }];
    const place = src({ bookings, leases });
    expect(placeMetrics(place, september)).toEqual(
      unitWindowMetrics(bookings, september, leases.map((l) => ({ start: l.startDate, end: l.endDate }))),
    );
  });

  it("occupied intervals cover stays and answered days, for free windows and prices", () => {
    const place = src({
      dailyMode: true,
      bookings: [
        { id: "b1", source: "manual", checkIn: d("2026-09-02"), checkOut: d("2026-09-04"), nights: 2, amount: 100 },
      ],
      days: [
        { date: d("2026-09-03"), amount: 50 }, // under the booking: not a second interval
        { date: d("2026-09-08"), amount: 50 },
      ],
    });
    expect(occupiedIntervals(place)).toEqual([
      { start: d("2026-09-02"), end: d("2026-09-04") },
      { start: d("2026-09-08"), end: d("2026-09-09") },
    ]);
  });
});

describe("marking nights on the asset calendar (the same record as the daily question)", () => {
  const place = src({
    dailyMode: true,
    bookings: [
      { id: "b1", source: "airbnb", checkIn: d("2026-10-03"), checkOut: d("2026-10-05"), nights: 2, amount: 300 },
    ],
  });

  it("'rented' answers only the nights no stay holds", () => {
    expect(nightsToAnswer(place, d("2026-10-02"), d("2026-10-06"), true)).toEqual([
      d("2026-10-02"),
      d("2026-10-05"),
    ]);
    expect(nightsToAnswer(place, d("2026-10-03"), d("2026-10-05"), true)).toEqual([]);
  });

  it("'not rented' answers every night (under a stay it is never shown)", () => {
    expect(nightsToAnswer(place, d("2026-10-02"), d("2026-10-06"), false)).toHaveLength(4);
  });

  it("marked nights then read like the dashboard's answers: counted once, beside the booking", () => {
    const marked = src({
      ...place,
      days: nightsToAnswer(place, d("2026-10-02"), d("2026-10-06"), true).map((date) => ({ date, amount: 120 })),
    });
    const october = { start: d("2026-10-01"), end: d("2026-11-01") };
    const metrics = placeMetrics(marked, october);
    expect(metrics.revenue).toBe(300 + 240);
    expect(metrics.occupiedNights).toBe(4);
    expect(metrics.bookedNights).toBe(4);
  });
});

describe("the analytics figure and the income total count the same nights", () => {
  it("a linked flat: bookings, a day-let contract and daily answers — nightly revenue = bookings + daily income", () => {
    const place = src({
      dailyMode: true,
      weekendPct: 20,
      holidayPct: 30,
      bookings: [
        { id: "b1", source: "airbnb", checkIn: d("2026-09-04"), checkOut: d("2026-09-07"), nights: 3, amount: 450 },
        { id: "b2", source: "booking", checkIn: d("2026-09-20"), checkOut: d("2026-09-22"), nights: 2, amount: null },
      ],
      contracts: [
        {
          id: "c1",
          startDate: d("2026-09-06"),
          endDate: d("2026-09-10"),
          paymentPeriod: "daily",
          paymentAmount: 100,
          monthlyRent: 3044,
        },
      ],
      days: [
        { date: d("2026-09-05"), amount: 999 }, // under the Airbnb stay
        { date: d("2026-09-08"), amount: 999 }, // under the contract
        { date: d("2026-09-15"), amount: 130 }, // a free night
      ],
    });
    const metrics = placeMetrics(place, september);
    const income = incomeInWindow(
      {
        assets: [
          {
            id: "a1", unitId: "u1", category: "real_estate", rentalMode: "daily",
            monthlyIncome: null, createdAt: d("2026-01-01"), weekendPct: 20, holidayPct: 30,
          },
        ],
        contracts: place.contracts.map((c) => ({ ...c, assetId: "a1" })),
        leases: [],
        bookings: place.bookings.map((b) => ({ ...b, unitId: "u1" })),
        dayEntries: place.days.map((day) => ({ ...day, assetId: "a1" })),
        records: [],
      },
      september,
    );
    expect(metrics.revenue).toBeCloseTo(income.bookings + income.daily, 6);
    // Nights: 4–6 Airbnb, 7–9 contract (the 6th is the booking's), 15th
    // answered, 20–21 unpriced import.
    expect(metrics.occupiedNights).toBe(9);
  });
});
