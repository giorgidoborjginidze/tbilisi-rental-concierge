// The order alerts are read in: what costs money or the car today first,
// advice last. /alerts lists them in this order (by asset or unit), the
// dashboard's "Today" block takes the urgent ones and Market Advice the
// rest — so a double booking or the repossession right is never pushed out
// by "free window" tips. Pure, client-safe.

export const ALERT_SEVERITY: Record<string, number> = {
  overlap: 0,
  repossession_right: 1,
  geofence_breach: 1,
  tracker_silent: 2,
  rent_overdue: 3,
  contract_ended: 4,
  contract_expiry: 5,
  lease_expiry: 5,
  // Money left on the table before a free night: the one "raise the price"
  // tip is never buried under routine free windows.
  underpriced: 6,
  vacancy_gap: 7,
};

export const alertRank = (type: string): number => ALERT_SEVERITY[type] ?? 8;

/**
 * Urgent: the dashboard's "Today" block lists these (late rent is there as
 * its own swipe cards).
 */
export const URGENT_TYPES: readonly string[] = [
  "overlap",
  "repossession_right",
  "geofence_breach",
  "tracker_silent",
];

/** What the bell's number counts: the urgent alerts and late rent. */
export const NEEDS_YOU_TYPES: readonly string[] = [...URGENT_TYPES, "rent_overdue"];

/** Not urgent: Market Advice closes the dashboard with these. */
export const ADVICE_TYPES: readonly string[] = [
  "underpriced",
  "vacancy_gap",
  "lease_expiry",
  "contract_expiry",
  "contract_ended",
];

interface DatedPayload {
  start?: unknown;
  dueDate?: unknown;
  endDate?: unknown;
  month?: unknown;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

/**
 * The day an alert is about ("YYYY-MM-DD"): a free window's or a double
 * booking's first night, a rent due date, a contract's end, the first of an
 * underpriced month. Null when it names no day.
 */
export function alertDay(payload: unknown): string | null {
  const p = (payload ?? {}) as DatedPayload;
  for (const value of [p.start, p.dueDate, p.endDate]) {
    if (typeof value === "string" && DAY.test(value)) return value;
  }
  if (typeof p.month === "string" && MONTH.test(p.month)) return `${p.month}-01`;
  return null;
}

/** Soonest day first; alerts without a day after those with one. */
export const byDay = (a: unknown, b: unknown): number => {
  const x = alertDay(a);
  const y = alertDay(b);
  if (x === y) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return x < y ? -1 : 1;
};

/** Most severe first; among equals the soonest day, then the newest. */
export function rankAlerts<T extends { type: string; createdAt: Date; payload?: unknown }>(
  alerts: T[],
): T[] {
  return [...alerts].sort(
    (a, b) =>
      alertRank(a.type) - alertRank(b.type) ||
      byDay(a.payload, b.payload) ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}
