// Pure revenue/occupancy math — no framework, no I/O.
//
// Definitions (industry-standard):
//   occupancy  = occupied nights / available nights (overlaps merged, so a
//                double-booked night counts once and occupancy caps at 100%)
//   ADR        = room revenue / booked nights (nights actually sold)
//   RevPAR     = room revenue / available nights
// Revenue is prorated by night when a stay straddles the window edge.
// Cancelled bookings are excluded by the caller; leases are tracked
// separately and are not part of STR metrics.

import { mergeIntervals, type Interval } from "@/lib/calendar/occupancy";

export interface BookingLike {
  checkIn: Date;
  checkOut: Date;
  nights: number;
  amount: number | null;
}

export interface WindowMetrics {
  availableNights: number;
  occupiedNights: number; // merged — no double counting
  bookedNights: number; // sum over bookings — basis for ADR
  revenue: number;
  occupancyRate: number; // 0..1
  adr: number | null; // null when nothing was sold
  revpar: number | null; // null when no available nights
}

const DAY_MS = 86_400_000;

export const nightsBetween = (start: Date, end: Date) =>
  Math.round((end.getTime() - start.getTime()) / DAY_MS);

const clip = (booking: BookingLike, window: Interval): Interval | null => {
  const start =
    booking.checkIn > window.start ? booking.checkIn : window.start;
  const end = booking.checkOut < window.end ? booking.checkOut : window.end;
  return end > start ? { start, end } : null;
};

export function clippedNights(booking: BookingLike, window: Interval): number {
  const clipped = clip(booking, window);
  return clipped ? nightsBetween(clipped.start, clipped.end) : 0;
}

// The share of the booking's amount earned inside the window.
export function proratedRevenue(
  booking: BookingLike,
  window: Interval,
): number {
  if (booking.amount == null || booking.nights <= 0) return 0;
  return (booking.amount * clippedNights(booking, window)) / booking.nights;
}

// Metrics for ONE unit over a window.
export function unitWindowMetrics(
  bookings: BookingLike[],
  window: Interval,
): WindowMetrics {
  const availableNights = nightsBetween(window.start, window.end);

  const clippedStays = bookings
    .map((b) => clip(b, window))
    .filter((i): i is Interval => i !== null);
  const occupiedNights = mergeIntervals(clippedStays).reduce(
    (sum, interval) => sum + nightsBetween(interval.start, interval.end),
    0,
  );

  const bookedNights = bookings.reduce(
    (sum, b) => sum + clippedNights(b, window),
    0,
  );
  const revenue = bookings.reduce(
    (sum, b) => sum + proratedRevenue(b, window),
    0,
  );

  return {
    availableNights,
    occupiedNights,
    bookedNights,
    revenue,
    occupancyRate: availableNights > 0 ? occupiedNights / availableNights : 0,
    adr: bookedNights > 0 ? revenue / bookedNights : null,
    revpar: availableNights > 0 ? revenue / availableNights : null,
  };
}

// Portfolio metrics: sum the per-unit absolutes, recompute the rates.
export function aggregateMetrics(units: WindowMetrics[]): WindowMetrics {
  const availableNights = units.reduce((s, m) => s + m.availableNights, 0);
  const occupiedNights = units.reduce((s, m) => s + m.occupiedNights, 0);
  const bookedNights = units.reduce((s, m) => s + m.bookedNights, 0);
  const revenue = units.reduce((s, m) => s + m.revenue, 0);
  return {
    availableNights,
    occupiedNights,
    bookedNights,
    revenue,
    occupancyRate: availableNights > 0 ? occupiedNights / availableNights : 0,
    adr: bookedNights > 0 ? revenue / bookedNights : null,
    revpar: availableNights > 0 ? revenue / availableNights : null,
  };
}

export interface MonthWindow extends Interval {
  key: string; // "YYYY-MM"
}

// Calendar months covering [from, to], inclusive of both endpoints' months.
export function monthWindows(from: Date, to: Date): MonthWindow[] {
  const windows: MonthWindow[] = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth(); // 0-based
  while (
    year < to.getUTCFullYear() ||
    (year === to.getUTCFullYear() && month <= to.getUTCMonth())
  ) {
    windows.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    });
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return windows;
}
