// Suggested nightly prices for free nights — the rule-based engine alone
// (./engine.ts), without the written rationale or the stored rows of
// ./run.ts, so the calendar can price every free window it shows. Pure.

import { suggestRate } from "./engine";

const DAY_MS = 86_400_000;

/** How much of the `days` nights from `from` the stays cover, 0..1 (the demand factor's input). */
export function occupancyShare(
  stays: { start: Date; end: Date }[],
  from: Date,
  days = 30,
): number {
  const end = from.getTime() + days * DAY_MS;
  const taken = new Set<number>();
  for (const stay of stays) {
    for (
      let night = Math.max(stay.start.getTime(), from.getTime());
      night < Math.min(stay.end.getTime(), end);
      night += DAY_MS
    ) {
      taken.add(night);
    }
  }
  return taken.size / days;
}

/** "YYYY-MM" of a night, the key market benchmarks are stored by. */
export const benchmarkMonth = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * The suggested price of each night of a free window, and the window's
 * price per night (the rounded average). `benchmarks` maps "YYYY-MM" to
 * the district's average nightly price, when known.
 */
export function windowPrice(
  unit: { baseNightlyRate: number; city: string },
  window: { start: Date; end: Date },
  occupancy: number,
  benchmarks: Map<string, number | null>,
): { perNight: number; nights: { date: Date; rate: number }[] } | null {
  const nights: { date: Date; rate: number }[] = [];
  for (let time = window.start.getTime(); time < window.end.getTime(); time += DAY_MS) {
    const date = new Date(time);
    nights.push({
      date,
      rate: suggestRate({
        baseNightlyRate: unit.baseNightlyRate,
        city: unit.city,
        date,
        upcomingOccupancy: occupancy,
        benchmarkAdr: benchmarks.get(benchmarkMonth(date)) ?? null,
      }).suggestedRate,
    });
  }
  if (nights.length === 0) return null;
  const perNight = Math.round(nights.reduce((sum, night) => sum + night.rate, 0) / nights.length);
  return { perNight, nights };
}

/**
 * Which nights the calendar lists free windows for: from today on (a past
 * night can no longer be let). On the current month that is the next 30
 * nights — so on the 30th the list still shows what can be sold — on a
 * later month its own nights, on a past month none.
 */
export function freeWindowRange(
  month: { start: Date; end: Date },
  today: Date,
  days = 30,
): { start: Date; end: Date } | null {
  if (month.end.getTime() <= today.getTime()) return null;
  if (month.start.getTime() <= today.getTime()) {
    const horizon = today.getTime() + days * DAY_MS;
    return { start: today, end: new Date(Math.max(month.end.getTime(), horizon)) };
  }
  return month;
}
