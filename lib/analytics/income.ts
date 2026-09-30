// Income for a window of time (a calendar month, as a rule) — the ONE
// definition behind every income figure in the app: the dashboard hero
// and KPIs, the six-month income bars and the /assets total. Pure — the
// database loading lives in ./monthly-income.ts.
//
// What it counts, and how:
//
//   rent      contracts on long-term assets and unit leases, per night:
//             a monthly rent is spread over the nights of each calendar
//             month (a lease from the 16th counts half of September), a
//             weekly rent is a seventh a night.
//   daily     assets let by the day: their contracts (each day at its own
//             price — weekend and holiday premiums included, exactly what
//             the schedule charges) and the "rented today?" answers.
//   bookings  unit stays, prorated by night (the same revenue the
//             analytics page shows).
//   other     dated income records, plus recurring income sources
//             (salary, dividends…) from the month they were added.
//
// One night of one place is money once. A unit and the asset linked to it
// are the same place, so a night covered by a priced booking is not also
// counted from a contract on that asset, and a night a contract covers is
// not counted again from a daily answer. Order of precedence: a priced
// booking, then a contract or lease (the latest-starting first), then the
// daily answer. Two bookings on one night (a double booking) both stay in
// "bookings", as they do on the analytics page.

import { dayPrice } from "../assets/daily-price";
import { asPeriod, perPeriodAmount } from "../rentals/amount";
import { proratedRevenue } from "./metrics";

const DAY_MS = 86_400_000;

export interface IncomeWindow {
  /** First day (stored form: UTC midnight). */
  start: Date;
  /** Exclusive. */
  end: Date;
}

export interface IncomeAsset {
  id: string;
  unitId: string | null;
  category: string;
  rentalMode: string;
  monthlyIncome: number | null;
  createdAt: Date;
  weekendPct: number | null;
  holidayPct: number | null;
}

export interface IncomeContract {
  assetId: string;
  startDate: Date;
  endDate: Date;
  paymentPeriod: string;
  paymentAmount: number | null;
  monthlyRent: number;
}

export interface IncomeLease {
  unitId: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
}

export interface IncomeBooking {
  unitId: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  amount: number | null;
}

export interface IncomeDay {
  assetId: string;
  date: Date;
  amount: number;
}

export interface IncomeRecordRow {
  date: Date;
  amount: number;
}

export interface IncomeSources {
  assets: IncomeAsset[];
  contracts: IncomeContract[];
  leases: IncomeLease[];
  /** Cancelled bookings are left out by the caller. */
  bookings: IncomeBooking[];
  /** Days answered "rented" only. */
  dayEntries: IncomeDay[];
  records: IncomeRecordRow[];
}

export interface IncomeBreakdown {
  rent: number;
  daily: number;
  bookings: number;
  other: number;
  total: number;
  /**
   * Booked nights with no price (iCal imports until the owner adds one)
   * that nothing else in the window pays for: the total is partial by
   * those nights, and the screens say so.
   */
  unpricedNights: number;
}

const dayStart = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const daysInMonthOf = (day: number) => {
  const date = new Date(day);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
};

/** Each night (as a UTC-midnight timestamp) of [from, to) inside the window. */
function* nightsIn(from: Date, to: Date, window: IncomeWindow) {
  const first = Math.max(dayStart(from), dayStart(window.start));
  const last = Math.min(dayStart(to), dayStart(window.end));
  for (let night = first; night < last; night += DAY_MS) yield night;
}

/** Calendar months the window touches, with the share of each it covers. */
function monthShares(window: IncomeWindow, since: Date | null) {
  const shares: number[] = [];
  const start = dayStart(window.start);
  const end = dayStart(window.end);
  let cursor = new Date(start);
  cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  while (cursor.getTime() < end) {
    const next = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
    if (!since || dayStart(since) < next) {
      const from = Math.max(cursor.getTime(), start);
      const to = Math.min(next, end);
      shares.push((to - from) / (next - cursor.getTime()));
    }
    cursor = new Date(next);
  }
  return shares;
}

export function incomeInWindow(
  sources: IncomeSources,
  window: IncomeWindow,
): IncomeBreakdown {
  const assets = new Map(sources.assets.map((asset) => [asset.id, asset]));
  const placeOfAsset = (assetId: string) => {
    const unitId = assets.get(assetId)?.unitId;
    return unitId ? `u:${unitId}` : `a:${assetId}`;
  };
  const claimed = new Set<string>();
  const claim = (place: string, night: number) => {
    const key = `${place}|${night}`;
    if (claimed.has(key)) return false;
    claimed.add(key);
    return true;
  };

  const result: IncomeBreakdown = { rent: 0, daily: 0, bookings: 0, other: 0, total: 0, unpricedNights: 0 };

  // 1 · Priced bookings: their prorated revenue, and their nights are taken.
  for (const booking of sources.bookings) {
    const revenue = proratedRevenue(booking, window);
    if (revenue <= 0) continue;
    result.bookings += revenue;
    for (const night of nightsIn(booking.checkIn, booking.checkOut, window)) {
      claimed.add(`u:${booking.unitId}|${night}`);
    }
  }

  // 2 · Contracts and leases, night by night, the latest-starting first
  //     (the same one activeContract() treats as running).
  const contracts = [...sources.contracts].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  );
  for (const contract of contracts) {
    const asset = assets.get(contract.assetId);
    const place = placeOfAsset(contract.assetId);
    const period = asPeriod(contract.paymentPeriod);
    const amount = perPeriodAmount(contract);
    const daily = asset?.rentalMode === "daily";
    const premiums = (asset?.weekendPct ?? 0) !== 0 || (asset?.holidayPct ?? 0) !== 0;
    for (const night of nightsIn(contract.startDate, contract.endDate, window)) {
      if (!claim(place, night)) continue;
      const value =
        period === "daily"
          ? premiums
            ? dayPrice(new Date(night), amount, asset?.weekendPct ?? 0, asset?.holidayPct ?? 0)
            : amount
          : period === "weekly"
            ? amount / 7
            : contract.monthlyRent / daysInMonthOf(night);
      if (daily) result.daily += value;
      else result.rent += value;
    }
  }
  const leases = [...sources.leases].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  );
  for (const lease of leases) {
    for (const night of nightsIn(lease.startDate, lease.endDate, window)) {
      if (!claim(`u:${lease.unitId}`, night)) continue;
      result.rent += lease.monthlyRent / daysInMonthOf(night);
    }
  }

  // 3 · The daily answers, for nights nothing above has counted.
  for (const day of sources.dayEntries) {
    if (day.amount <= 0) continue;
    const night = dayStart(day.date);
    if (night < dayStart(window.start) || night >= dayStart(window.end)) continue;
    if (!claim(placeOfAsset(day.assetId), night)) continue;
    result.daily += day.amount;
  }

  // 3b · Booked nights without a price that no contract, lease or daily
  //      answer paid for: the income is partial by these nights.
  for (const booking of sources.bookings) {
    if (booking.amount != null) continue;
    for (const night of nightsIn(booking.checkIn, booking.checkOut, window)) {
      if (claim(`u:${booking.unitId}`, night)) result.unpricedNights += 1;
    }
  }

  // 4 · Dated income records and recurring income sources.
  for (const record of sources.records) {
    const day = dayStart(record.date);
    if (day >= dayStart(window.start) && day < dayStart(window.end)) {
      result.other += record.amount;
    }
  }
  for (const asset of sources.assets) {
    if (asset.category !== "income_source" || !asset.monthlyIncome) continue;
    for (const share of monthShares(window, asset.createdAt)) {
      result.other += asset.monthlyIncome * share;
    }
  }

  result.total = result.rent + result.daily + result.bookings + result.other;
  return result;
}

/** Calendar-month windows: `count` months starting at `first` (a 1st). */
export function monthWindowsFrom(first: Date, count: number): IncomeWindow[] {
  return Array.from({ length: count }, (_, i) => ({
    start: new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, 1)),
    end: new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i + 1, 1)),
  }));
}
