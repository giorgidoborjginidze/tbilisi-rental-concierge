import { describe, expect, it } from "vitest";
import { incomeInWindow, monthWindowsFrom, type IncomeSources } from "./income";
import { unitWindowMetrics, aggregateMetrics } from "./metrics";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const SEPT = { start: d("2026-09-01"), end: d("2026-10-01") };

const asset = (id: string, extra: Partial<IncomeSources["assets"][number]> = {}) => ({
  id,
  unitId: null,
  category: "real_estate",
  rentalMode: "long_term",
  monthlyIncome: null,
  createdAt: d("2026-01-01"),
  weekendPct: null,
  holidayPct: null,
  ...extra,
});

const empty = (): IncomeSources => ({
  assets: [],
  contracts: [],
  leases: [],
  bookings: [],
  dayEntries: [],
  records: [],
});

describe("monthly income — one definition", () => {
  it("normalises by the payment period: a weekly car is 30 nights of 350/7", () => {
    const sources = empty();
    sources.assets.push(asset("car", { category: "vehicle" }));
    sources.contracts.push({
      assetId: "car",
      startDate: d("2026-08-01"),
      endDate: d("2027-08-01"),
      paymentPeriod: "weekly",
      paymentAmount: 350,
      monthlyRent: 1520.75,
    });
    const income = incomeInWindow(sources, SEPT);
    expect(income.rent).toBeCloseTo(1500, 6);
    expect(income.total).toBeCloseTo(1500, 6);
  });

  it("prorates a lease that starts mid-month", () => {
    const sources = empty();
    sources.assets.push(asset("flat"));
    sources.contracts.push({
      assetId: "flat",
      startDate: d("2026-09-16"),
      endDate: d("2027-09-16"),
      paymentPeriod: "monthly",
      paymentAmount: 1200,
      monthlyRent: 1200,
    });
    expect(incomeInWindow(sources, SEPT).rent).toBeCloseTo(600, 6);
  });

  it("prices a daily contract on a daily-let asset day by day, weekends up", () => {
    const sources = empty();
    sources.assets.push(
      asset("taxi", { category: "vehicle", rentalMode: "daily", weekendPct: 20, holidayPct: 30 }),
    );
    sources.contracts.push({
      assetId: "taxi",
      startDate: d("2026-09-21"), // Monday
      endDate: d("2026-09-28"), // a full week: Sat 26 and Sun 27 at +20%
      paymentPeriod: "daily",
      paymentAmount: 60,
      monthlyRent: 1826.4,
    });
    const income = incomeInWindow(sources, SEPT);
    expect(income.daily).toBe(5 * 60 + 2 * 72);
    expect(income.rent).toBe(0);
  });

  it("counts a night once when a contract and a daily answer both cover it", () => {
    const sources = empty();
    sources.assets.push(asset("studio", { rentalMode: "daily" }));
    sources.contracts.push({
      assetId: "studio",
      startDate: d("2026-09-30"),
      endDate: d("2026-10-01"),
      paymentPeriod: "daily",
      paymentAmount: 180,
      monthlyRent: 5479.2,
    });
    sources.dayEntries.push(
      { assetId: "studio", date: d("2026-09-30"), amount: 180 }, // same night
      { assetId: "studio", date: d("2026-09-12"), amount: 150 }, // another night
    );
    expect(incomeInWindow(sources, SEPT).daily).toBe(180 + 150);
  });

  it("treats a unit and its linked asset as one place: a priced booking wins the night", () => {
    const sources = empty();
    sources.assets.push(asset("flat", { unitId: "u1", rentalMode: "daily" }));
    sources.bookings.push({
      unitId: "u1",
      checkIn: d("2026-09-10"),
      checkOut: d("2026-09-12"),
      nights: 2,
      amount: 400,
    });
    sources.contracts.push({
      assetId: "flat",
      startDate: d("2026-09-11"),
      endDate: d("2026-09-13"),
      paymentPeriod: "daily",
      paymentAmount: 150,
      monthlyRent: 4566,
    });
    sources.dayEntries.push({ assetId: "flat", date: d("2026-09-10"), amount: 180 });
    const income = incomeInWindow(sources, SEPT);
    expect(income.bookings).toBe(400); // nights 10 and 11
    expect(income.daily).toBe(150); // only night 12 is left for the contract
    expect(income.total).toBe(550);
  });

  it("a booking with no price does not hide the contract's rent", () => {
    const sources = empty();
    sources.assets.push(asset("flat", { unitId: "u1" }));
    sources.bookings.push({
      unitId: "u1",
      checkIn: d("2026-09-01"),
      checkOut: d("2026-10-01"),
      nights: 30,
      amount: null, // an iCal block
    });
    sources.contracts.push({
      assetId: "flat",
      startDate: d("2026-01-01"),
      endDate: d("2027-01-01"),
      paymentPeriod: "monthly",
      paymentAmount: 1200,
      monthlyRent: 1200,
    });
    const income = incomeInWindow(sources, SEPT);
    expect(income.total).toBeCloseTo(1200, 6);
    // The contract pays for those nights: the income is not partial.
    expect(income.unpricedNights).toBe(0);
  });

  it("counts unpriced booked nights nothing else pays for (the total is partial)", () => {
    const sources = empty();
    sources.bookings.push(
      { unitId: "u1", checkIn: d("2026-09-28"), checkOut: d("2026-10-03"), nights: 5, amount: null },
      // Double-booked unpriced night: one place-night, counted once.
      { unitId: "u1", checkIn: d("2026-09-29"), checkOut: d("2026-09-30"), nights: 1, amount: null },
      { unitId: "u1", checkIn: d("2026-09-10"), checkOut: d("2026-09-12"), nights: 2, amount: 200 },
    );
    const income = incomeInWindow(sources, SEPT);
    expect(income.bookings).toBeCloseTo(200, 6);
    expect(income.unpricedNights).toBe(3); // 28, 29, 30 September
  });

  it("counts unit leases as rent, prorated", () => {
    const sources = empty();
    sources.leases.push({
      unitId: "u9",
      startDate: d("2026-09-01"),
      endDate: d("2027-03-01"),
      monthlyRent: 1800,
    });
    const aug = incomeInWindow(sources, { start: d("2026-08-01"), end: d("2026-09-01") });
    expect(aug.total).toBe(0);
    expect(incomeInWindow(sources, SEPT).rent).toBeCloseTo(1800, 6);
  });

  it("counts recurring income from the month it was added, and dated records", () => {
    const sources = empty();
    sources.assets.push(
      asset("salary", { category: "income_source", monthlyIncome: 3000, createdAt: d("2026-09-20") }),
    );
    sources.records.push(
      { date: d("2026-09-05"), amount: 250 },
      { date: d("2026-10-01"), amount: 999 }, // next month
    );
    const [aug, sep] = monthWindowsFrom(d("2026-08-01"), 2).map((w) => incomeInWindow(sources, w));
    expect(aug.other).toBe(0);
    expect(sep.other).toBe(3250);
  });

  it("the audited landlord month adds up", () => {
    // Flat 1,200 / month, a one-night daily let of 180 also answered in the
    // daily check, and a car at 350 a week.
    const sources = empty();
    sources.assets.push(
      asset("flat"),
      asset("studio", { rentalMode: "daily" }),
      asset("car", { category: "vehicle" }),
    );
    sources.contracts.push(
      {
        assetId: "flat",
        startDate: d("2026-03-01"),
        endDate: d("2027-03-01"),
        paymentPeriod: "monthly",
        paymentAmount: 1200,
        monthlyRent: 1200,
      },
      {
        assetId: "studio",
        startDate: d("2026-09-30"),
        endDate: d("2026-10-01"),
        paymentPeriod: "daily",
        paymentAmount: 180,
        monthlyRent: 5479.2,
      },
      {
        assetId: "car",
        startDate: d("2026-06-01"),
        endDate: d("2027-06-01"),
        paymentPeriod: "weekly",
        paymentAmount: 350,
        monthlyRent: 1520.75,
      },
    );
    sources.dayEntries.push({ assetId: "studio", date: d("2026-09-30"), amount: 180 });
    const income = incomeInWindow(sources, SEPT);
    expect(income.rent).toBeCloseTo(1200 + 1500, 6);
    expect(income.daily).toBe(180);
    expect(income.total).toBeCloseTo(2880, 6);
  });

  it("keeps the booking figure equal to the analytics revenue", () => {
    const stays = [
      { unitId: "u1", checkIn: d("2026-08-29"), checkOut: d("2026-09-03"), nights: 5, amount: 500 },
      { unitId: "u1", checkIn: d("2026-09-10"), checkOut: d("2026-09-12"), nights: 2, amount: 260 },
      // a double booking stays in both figures
      { unitId: "u1", checkIn: d("2026-09-11"), checkOut: d("2026-09-12"), nights: 1, amount: 140 },
      { unitId: "u2", checkIn: d("2026-09-28"), checkOut: d("2026-10-04"), nights: 6, amount: 600 },
    ];
    const sources = empty();
    sources.bookings.push(...stays);
    const analytics = aggregateMetrics(
      ["u1", "u2"].map((unit) =>
        unitWindowMetrics(stays.filter((s) => s.unitId === unit), SEPT),
      ),
    );
    expect(incomeInWindow(sources, SEPT).bookings).toBeCloseTo(analytics.revenue, 6);
  });
});
