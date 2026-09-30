// What the alert scan says about a unit's calendar, as pure functions:
// which free windows are worth an alert, which double bookings exist, and
// which open alerts about either no longer hold.
//
// A free window is identified by what bounds it — the day the stay before
// it ends and the day the stay after it begins — not by "today". The
// leading window of an empty unit used to start "today", so its key moved
// every day and the same vacancy was announced again each morning. Now the
// window from the 28th's checkout to the 6th's check-in is one alert until
// it is booked or over, and its figures (nights left) are refreshed.
//
// Stays are half-open [start, end): the end is the checkout day. Dates are
// calendar days in stored form (UTC midnight); `today` is Tbilisi's today.

import { findGaps, findOverlaps, type Stay } from "@/lib/calendar/occupancy";
import { dayKey } from "@/lib/time";
import type { WithdrawReason } from "@/lib/rentals/settle";

const DAY_MS = 86_400_000;

/** Only windows starting this soon are worth an alert. */
export const VACANCY_LEAD_DAYS = 14;
/** How far ahead a window is followed to find its end. */
export const VACANCY_HORIZON_DAYS = 30;
/** Shorter windows are not worth an alert. */
export const VACANCY_MIN_NIGHTS = 2;
/** Double bookings are looked for this far ahead. */
export const OVERLAP_HORIZON_DAYS = 90;

/** "open": no stay bounds the window on that side. */
export const OPEN = "open";

export interface VacancySignal {
  /** `${from}|${to}` — the bounding checkout and check-in days, or "open". */
  key: string;
  /** First free night from today on. */
  start: Date;
  /** The day the next stay begins — or the horizon, when none is booked. */
  end: Date;
  nights: number;
  /** No stay is booked after it within the horizon. */
  openEnd: boolean;
}

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

/**
 * The free windows of a unit that deserve an alert today. `stays` must
 * include the last stay that ended before today (its checkout bounds the
 * leading window), and everything booked within the horizon.
 */
export function vacancySignals(
  stays: Stay[],
  today: Date,
  {
    leadDays = VACANCY_LEAD_DAYS,
    horizonDays = VACANCY_HORIZON_DAYS,
    minNights = VACANCY_MIN_NIGHTS,
  } = {},
): VacancySignal[] {
  const horizon = addDays(today, horizonDays);
  const lead = addDays(today, leadDays);
  return findGaps(stays, { start: today, end: horizon }, minNights)
    .filter((gap) => gap.start < lead)
    .map((gap) => {
      // The stay before: the latest checkout on or before the window starts.
      const before = stays
        .filter((stay) => stay.end <= gap.start)
        .reduce<Date | null>((latest, stay) => (!latest || stay.end > latest ? stay.end : latest), null);
      // The stay after: one that begins exactly where the window ends.
      const after = stays.some((stay) => stay.start.getTime() === gap.end.getTime());
      const openEnd = !after;
      return {
        key: `${before ? dayKey(before) : OPEN}|${openEnd ? OPEN : dayKey(gap.end)}`,
        start: gap.start,
        end: gap.end,
        nights: gap.nights,
        openEnd,
      };
    });
}

export interface OverlapSignal {
  /** The two stays' ids, sorted — the same pair is one alert. */
  key: string;
  start: Date;
  end: Date;
  nights: number;
  stays: [Stay, Stay];
}

/**
 * Pairs of stays that share at least one night, from today to the
 * horizon. Stays already over are left out: a clash in the past can no
 * longer be fixed.
 */
export function overlapSignals(
  stays: Stay[],
  today: Date,
  horizonDays: number = OVERLAP_HORIZON_DAYS,
): OverlapSignal[] {
  const horizon = addDays(today, horizonDays);
  const live = stays.filter((stay) => stay.end > today && stay.start < horizon);
  const byId = new Map(live.map((stay) => [stay.id, stay]));
  return findOverlaps(live).map((overlap) => {
    const [a, b] = [...overlap.stayIds].sort();
    return {
      key: `${a}|${b}`,
      start: overlap.start,
      end: overlap.end,
      nights: overlap.nights,
      stays: [byId.get(a)!, byId.get(b)!],
    };
  });
}

interface OpenCalendarAlert {
  id: string;
  payload: unknown;
}

const payloadOf = (payload: unknown) =>
  (payload ?? {}) as { key?: string; start?: string; end?: string };

const dayOf = (key: string | undefined) => (key ? new Date(`${key}T00:00:00Z`) : null);

/**
 * Open "free window" alerts of one unit that no longer hold, and why: its
 * dates are over (or too little of it is left to sell), a stay now covers
 * part of it, or it was replaced by an alert that describes it better
 * (the window grew because a stay before it was cancelled, or the alert
 * dates from before windows had stable keys).
 */
export function staleVacancyAlerts(
  alerts: OpenCalendarAlert[],
  current: Set<string>,
  stays: Stay[],
  today: Date,
  minNights: number = VACANCY_MIN_NIGHTS,
): { id: string; reason: WithdrawReason }[] {
  const stale: { id: string; reason: WithdrawReason }[] = [];
  for (const alert of alerts) {
    const payload = payloadOf(alert.payload);
    if (payload.key && current.has(payload.key)) continue;
    const start = dayOf(payload.start);
    const end = dayOf(payload.end);
    const from = start && start > today ? start : today;
    let reason: WithdrawReason;
    if (!end || end.getTime() - from.getTime() < minNights * DAY_MS) reason = "passed";
    else if (stays.some((stay) => stay.start < end && stay.end > from)) reason = "filled";
    else reason = "replaced";
    stale.push({ id: alert.id, reason });
  }
  return stale;
}

/** Open double-booking alerts that no longer hold, and why. */
export function staleOverlapAlerts(
  alerts: OpenCalendarAlert[],
  current: Set<string>,
  today: Date,
): { id: string; reason: WithdrawReason }[] {
  return alerts
    .filter((alert) => {
      const key = payloadOf(alert.payload).key;
      return !key || !current.has(key);
    })
    .map((alert) => {
      const end = dayOf(payloadOf(alert.payload).end);
      return { id: alert.id, reason: end && end <= today ? "passed" : "overlap_cleared" };
    });
}
