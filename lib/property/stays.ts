// One rentable place, one night, one source. Pure — the loading lives in
// ./places.ts.
//
// A flat can be entered as a Unit (Rentals: iCal bookings, leases) or as a
// real-estate Asset (portfolio: value, contracts, the daily "rented
// today?" answers) — and, since this package, the two are linked: a Unit
// and the Asset linked to it are ONE place. Everything that says a night of
// that place is taken lives in one of four records:
//
//   bookings   the unit's stays (iCal imports, manual/direct entries)
//   leases     the unit's long lets (Lease rows)
//   contracts  the linked asset's RentalContracts — nightly sales when the
//              asset is let by the day (rentalMode "daily"), long lets
//              otherwise (the same split lib/analytics/income.ts makes)
//   days       the linked asset's DayEntry answers ("rented today?" on the
//              dashboard, and nights marked on the asset's own calendar —
//              both write DayEntry, see lib/rentals/actions.ts saveDayRange)
//
// Every screen that shows or counts nights — the Rentals calendar, the
// asset's calendar, /analytics, the hotel KPIs, the free-window prices and
// the vacancy alerts — asks this module, so a night is never counted
// twice and never silently missing:
//
//   - Bookings, leases and contracts are STAYS. Two of them on one night
//     are a double booking and are shown as such (never merged away).
//   - A daily answer is not a stay: it only fills a night no stay covers
//     (dayFills). Answering "rented" for a night an Airbnb booking already
//     holds adds nothing — the booking is the record of that night.
//   - Money follows lib/analytics/income.ts exactly: a priced booking owns
//     its nights, then contracts and leases (the latest-starting first),
//     then the daily answer (nightOwners). Two bookings on one night both
//     keep their revenue, as the analytics page always did.

import { dayPrice } from "@/lib/assets/daily-price";
import { asPeriod, perPeriodAmount } from "@/lib/rentals/amount";
import type { WindowMetrics } from "@/lib/analytics/metrics";
import type { Interval, Stay } from "@/lib/calendar/occupancy";

const DAY_MS = 86_400_000;

export interface PlaceBooking {
  id: string;
  source: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  amount: number | null;
}

export interface PlaceLease {
  id: string;
  startDate: Date;
  endDate: Date;
}

export interface PlaceContract {
  id: string;
  startDate: Date;
  endDate: Date;
  paymentPeriod: string;
  paymentAmount: number | null;
  monthlyRent: number;
}

export interface PlaceDay {
  /** UTC midnight of the day (DayEntry.date). */
  date: Date;
  /** Agreed amount for that day. Only "rented" answers are passed in. */
  amount: number;
}

export interface PlaceSources {
  bookings: PlaceBooking[];
  leases: PlaceLease[];
  contracts: PlaceContract[];
  days: PlaceDay[];
  /**
   * The asset is let by the day: its contracts sell nights (they count
   * like bookings). Otherwise its contracts are long lets (like leases).
   */
  dailyMode: boolean;
  weekendPct: number;
  holidayPct: number;
}

export const emptySources = (): PlaceSources => ({
  bookings: [],
  leases: [],
  contracts: [],
  days: [],
  dailyMode: false,
  weekendPct: 0,
  holidayPct: 0,
});

/** Calendar colour key of a stay: a booking's channel, "lease", "contract" or "day". */
export type StayKind = string;

export interface PlaceStay extends Stay {
  /** "sold": a night sold short-term; "lease": a long let, not for sale. */
  role: "sold" | "lease";
  /** Which record it is. */
  record: "booking" | "lease" | "contract" | "day";
}

const dayStart = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/**
 * The stays of a place — bookings, leases and contracts — for the calendar
 * grid, the double-booking check and the free windows. Daily answers are
 * not among them (see dayFills).
 */
export function placeStays(src: PlaceSources): PlaceStay[] {
  return [
    ...src.bookings.map((b) => ({
      id: b.id,
      kind: b.source,
      start: b.checkIn,
      end: b.checkOut,
      role: "sold" as const,
      record: "booking" as const,
    })),
    ...src.leases.map((l) => ({
      id: l.id,
      kind: "lease",
      start: l.startDate,
      end: l.endDate,
      role: "lease" as const,
      record: "lease" as const,
    })),
    ...src.contracts.map((c) => ({
      id: c.id,
      kind: src.dailyMode ? "contract" : "lease",
      start: c.startDate,
      end: c.endDate,
      role: src.dailyMode ? ("sold" as const) : ("lease" as const),
      record: "contract" as const,
    })),
  ];
}

/**
 * "Rented" daily answers on nights no stay covers, as one-night stays.
 * A night a booking, lease or contract already holds is theirs: the
 * answer is kept in the database but never drawn or counted twice.
 */
export function dayFills(src: PlaceSources): PlaceStay[] {
  const stays = placeStays(src);
  const fills: PlaceStay[] = [];
  const seen = new Set<number>();
  for (const day of src.days) {
    const night = dayStart(day.date);
    if (seen.has(night)) continue;
    seen.add(night);
    const covered = stays.some(
      (stay) => stay.start.getTime() <= night && stay.end.getTime() > night,
    );
    if (covered) continue;
    fills.push({
      id: `day:${night}`,
      kind: "day",
      start: new Date(night),
      end: new Date(night + DAY_MS),
      role: "sold",
      record: "day",
    });
  }
  return fills;
}

/** Every interval that makes a night taken: stays and daily answers. */
export function occupiedIntervals(src: PlaceSources): Interval[] {
  return [...placeStays(src), ...dayFills(src)].map((stay) => ({
    start: stay.start,
    end: stay.end,
  }));
}

/** The first stay covering a given night (UTC midnight), daily answers included. */
export function stayOn(src: PlaceSources, night: Date): PlaceStay | null {
  const at = dayStart(night);
  return (
    [...placeStays(src), ...dayFills(src)].find(
      (stay) => stay.start.getTime() <= at && stay.end.getTime() > at,
    ) ?? null
  );
}

const daysInMonthOf = (night: number) => {
  const date = new Date(night);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
};

/** What one night of a contract earns — the same rule as lib/analytics/income.ts. */
export function contractNightValue(
  contract: PlaceContract,
  night: number,
  src: Pick<PlaceSources, "weekendPct" | "holidayPct">,
): number {
  const period = asPeriod(contract.paymentPeriod);
  const amount = perPeriodAmount(contract);
  if (period === "daily") {
    return src.weekendPct !== 0 || src.holidayPct !== 0
      ? dayPrice(new Date(night), amount, src.weekendPct, src.holidayPct)
      : amount;
  }
  return period === "weekly" ? amount / 7 : contract.monthlyRent / daysInMonthOf(night);
}

export interface NightOwner {
  record: "booking" | "lease" | "contract" | "day";
  id: string;
  /** The night's money for contracts and daily answers; null for bookings (prorated) and leases. */
  value: number | null;
}

/**
 * Who owns each night of the window (UTC-midnight timestamps), in the
 * order lib/analytics/income.ts counts money: a priced booking, then
 * contracts (latest-starting first), then leases (latest-starting first),
 * then the daily answer. Nights only an unpriced booking holds are not
 * owned (they are "partial" nights).
 */
export function nightOwners(src: PlaceSources, window: Interval): Map<number, NightOwner> {
  const owners = new Map<number, NightOwner>();
  const from = dayStart(window.start);
  const to = dayStart(window.end);
  const nights = function* (start: Date, end: Date) {
    for (let night = Math.max(dayStart(start), from); night < Math.min(dayStart(end), to); night += DAY_MS) {
      yield night;
    }
  };
  const claim = (night: number, owner: NightOwner) => {
    if (!owners.has(night)) owners.set(night, owner);
  };

  for (const booking of src.bookings) {
    if (booking.amount == null || booking.amount <= 0 || booking.nights <= 0) continue;
    for (const night of nights(booking.checkIn, booking.checkOut)) {
      claim(night, { record: "booking", id: booking.id, value: null });
    }
  }
  const latestFirst = <T extends { startDate: Date }>(rows: T[]) =>
    [...rows].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  for (const contract of latestFirst(src.contracts)) {
    for (const night of nights(contract.startDate, contract.endDate)) {
      claim(night, { record: "contract", id: contract.id, value: contractNightValue(contract, night, src) });
    }
  }
  for (const lease of latestFirst(src.leases)) {
    for (const night of nights(lease.startDate, lease.endDate)) {
      claim(night, { record: "lease", id: lease.id, value: null });
    }
  }
  for (const day of src.days) {
    if (day.amount <= 0) continue;
    const night = dayStart(day.date);
    if (night < from || night >= to) continue;
    claim(night, { record: "day", id: `day:${night}`, value: day.amount });
  }
  return owners;
}

/**
 * Occupancy and revenue of one place over a window — /analytics and the
 * hotel dashboard. With only bookings and leases this is exactly
 * unitWindowMetrics (lib/analytics/metrics.ts); a day-let asset's
 * contracts and daily answers add the nights they own — never a night a
 * priced booking already sold — and a long contract's nights are leased
 * nights, like a Lease. A daily answer on a night an unpriced import
 * holds gives that night its price: sold once, not "partial".
 */
export function placeMetrics(src: PlaceSources, window: Interval): WindowMetrics {
  const from = dayStart(window.start);
  const to = dayStart(window.end);
  const nightsOf = (start: Date, end: Date) => {
    const out: number[] = [];
    for (let night = Math.max(dayStart(start), from); night < Math.min(dayStart(end), to); night += DAY_MS) {
      out.push(night);
    }
    return out;
  };

  const leased = new Set<number>();
  for (const lease of src.leases) nightsOf(lease.startDate, lease.endDate).forEach((n) => leased.add(n));
  if (!src.dailyMode) {
    for (const contract of src.contracts) {
      nightsOf(contract.startDate, contract.endDate).forEach((n) => leased.add(n));
    }
  }

  // Nights a day-let contract or a daily answer sold, with their price.
  const owned = new Map<number, number>();
  for (const [night, owner] of nightOwners(src, window)) {
    if (owner.record === "day" || (owner.record === "contract" && src.dailyMode)) {
      owned.set(night, owner.value ?? 0);
    }
  }

  const sold = new Set<number>(owned.keys());
  const bookedByBooking = new Set<number>();
  let bookedNights = 0;
  let unpricedNights = 0;
  let revenue = 0;
  for (const booking of src.bookings) {
    const nights = nightsOf(booking.checkIn, booking.checkOut);
    bookedNights += nights.length;
    for (const night of nights) {
      sold.add(night);
      bookedByBooking.add(night);
      // An unknown price, unless a daily answer or contract priced the night.
      if (booking.amount == null && !owned.has(night)) unpricedNights += 1;
    }
    if (booking.amount != null && booking.nights > 0) {
      revenue += (booking.amount * nights.length) / booking.nights;
    }
  }
  for (const [night, value] of owned) {
    revenue += value;
    if (!bookedByBooking.has(night)) bookedNights += 1;
  }

  const windowNights = Math.max(0, Math.round((to - from) / DAY_MS));
  const availableNights = windowNights - leased.size;
  let occupiedNights = 0;
  for (const night of sold) if (!leased.has(night)) occupiedNights += 1;
  const pricedNights = bookedNights - unpricedNights;

  return {
    availableNights,
    leasedNights: leased.size,
    occupiedNights,
    bookedNights,
    unpricedNights,
    revenue,
    occupancyRate: availableNights > 0 ? occupiedNights / availableNights : 0,
    adr: pricedNights > 0 ? revenue / pricedNights : null,
    revpar: availableNights > 0 ? revenue / availableNights : null,
  };
}

/** The longest stretch marked on an asset calendar at once (its six months). */
export const MAX_MARKED_NIGHTS = 186;

/**
 * The nights [start, end) that marking a stretch on the asset calendar
 * writes a daily answer for. "Rented" skips the nights a booking, lease or
 * contract already holds — that stay is the record of those nights — and
 * "not rented" answers every night (an answer under a stay is never shown).
 */
export function nightsToAnswer(
  src: PlaceSources,
  start: Date,
  end: Date,
  rented: boolean,
): Date[] {
  const stays = placeStays(src);
  const out: Date[] = [];
  for (let night = dayStart(start); night < dayStart(end); night += DAY_MS) {
    const taken = stays.some(
      (stay) => stay.start.getTime() <= night && stay.end.getTime() > night,
    );
    if (!rented || !taken) out.push(new Date(night));
  }
  return out;
}
