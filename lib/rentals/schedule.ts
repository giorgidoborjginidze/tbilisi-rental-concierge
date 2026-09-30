// Payment schedule for a rental contract.
//
// Rent is paid up front, per period: every day, every week or every
// month. The contract also names how many days late is still tolerated
// (typically 3). Once the delay passes that grace period — day 4 with
// graceDays = 3 — a car owner has the contractual right to take the
// vehicle back, and a landlord may act under the lease. This module is
// the single place that decides that, so the alert scan, the WhatsApp
// messages and the UI can never disagree.
//
// Periods are anchored on the contract's start day: period N begins at
// start + N periods, computed from the start every time. A lease from
// 31 January therefore falls due on 28 February and then on 31 March —
// the clamp in a short month never sticks.
//
// Framework-free and pure: dates in, status out, no database.

export type PaymentPeriod = "daily" | "weekly" | "monthly";

export const PAYMENT_PERIODS: PaymentPeriod[] = ["daily", "weekly", "monthly"];

export type PaymentState =
  | "not_started" // the contract has not begun yet
  | "ok" // everything due so far is paid
  | "due" // a payment is due today, not yet late
  | "grace" // late, but still inside the tolerated window
  | "repossess" // past the grace period — repossession right is live
  | "ended"; // contract finished and nothing outstanding

export interface ScheduleInput {
  startDate: Date;
  /** Exclusive: the day the rental is over. */
  endDate: Date;
  period: PaymentPeriod;
  /** Amount per period — the flat rate. */
  amount: number;
  /**
   * Optional per-period rate. Daily rentals charge more at weekends and
   * on public holidays, so what is owed is not simply periods × amount:
   * each period is priced on the day it starts. The payment ledger uses
   * the same function, so paying the amount shown settles exactly the
   * periods shown.
   */
  rateFor?: (periodStart: Date) => number;
  /** Days of delay the contract tolerates before repossession. */
  graceDays: number;
  /**
   * Paid up to (exclusive). Null = nothing paid yet. A date between two
   * period boundaries is moved up to the next boundary.
   */
  paidThrough: Date | null;
  /** Money already received toward the next period (part payments). */
  credit?: number;
  today: Date;
}

export interface ScheduleStatus {
  period: PaymentPeriod;
  state: PaymentState;
  /** Start of the first unpaid period — the day it must be paid on. */
  nextDueDate: Date;
  /** Paid up to (exclusive), clamped into the contract's own window. */
  paidThrough: Date;
  /** Unpaid periods whose due date has already arrived. */
  periodsOwed: number;
  /**
   * What is still to pay for every owed period, holidays included, less
   * the credit already received toward them.
   */
  amountDue: number;
  /** Credit held toward the next period. */
  credit: number;
  /** Whole days between the due date and today (0 when not late). */
  daysOverdue: number;
  graceDays: number;
  /** Last day the delay is still tolerated. */
  graceEndsOn: Date;
  /** First day the owner may act on the repossession right. */
  repossessFrom: Date;
  canRepossess: boolean;
}

const DAY_MS = 86_400_000;

/** Midnight UTC of the day `date` falls on. */
export function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Add whole calendar months, clamping the day of month so that
 * 31 January + 1 month lands on 28 (or 29) February rather than March.
 */
export function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

/** Move `date` forward by `count` payment periods. */
export function addPeriods(
  date: Date,
  period: PaymentPeriod,
  count: number,
): Date {
  if (period === "monthly") return addMonths(date, count);
  return addDays(date, count * (period === "weekly" ? 7 : 1));
}

/**
 * Start of period `n` (0 = the contract start). Always computed from the
 * start, so a clamped month never shifts the months after it.
 */
export function periodBoundary(
  start: Date,
  period: PaymentPeriod,
  n: number,
): Date {
  return addPeriods(startOfDay(start), period, n);
}

/** Index of the first period boundary on or after `date`. */
export function boundaryIndexOnOrAfter(
  start: Date,
  period: PaymentPeriod,
  date: Date,
): number {
  const s = startOfDay(start);
  const d = startOfDay(date);
  if (d <= s) return 0;
  if (period !== "monthly") {
    const days = Math.round((d.getTime() - s.getTime()) / DAY_MS);
    return Math.ceil(days / (period === "weekly" ? 7 : 1));
  }
  let n =
    (d.getUTCFullYear() - s.getUTCFullYear()) * 12 +
    (d.getUTCMonth() - s.getUTCMonth());
  while (n > 0 && addMonths(s, n - 1) >= d) n -= 1;
  while (addMonths(s, n) < d) n += 1;
  return n;
}

/**
 * The first period boundary on or after `date`, never past the contract
 * end. Used to turn a typed "paid up to" date into a point the schedule
 * can count from.
 */
export function snapToBoundary(
  start: Date,
  end: Date,
  period: PaymentPeriod,
  date: Date,
): Date {
  const s = startOfDay(start);
  const e = startOfDay(end);
  const d = startOfDay(date);
  if (d <= s) return s;
  if (d >= e) return e;
  const boundary = periodBoundary(s, period, boundaryIndexOnOrAfter(s, period, d));
  return boundary > e ? e : boundary;
}

/**
 * Default "paid up to" for a newly entered contract: the first due date on
 * or after today. A lease that is already running therefore starts in good
 * standing (every period that began before today counts as paid), one due
 * today shows as due rather than late, and a contract that has not started
 * yet counts from its first day.
 */
export function defaultPaidThrough(
  start: Date,
  end: Date,
  period: PaymentPeriod,
  today: Date,
): Date {
  return snapToBoundary(start, end, period, today);
}

/** How many whole periods fit between two dates (never negative). */
export function periodsBetween(
  from: Date,
  to: Date,
  period: PaymentPeriod,
): number {
  if (to <= from) return 0;
  if (period === "daily") return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
  if (period === "weekly")
    return Math.floor((to.getTime() - from.getTime()) / (7 * DAY_MS));
  // Monthly: count calendar months, then check the partial one.
  let count =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  if (addMonths(from, count) > to) count -= 1;
  return Math.max(0, count);
}

/** How many whole periods an amount of money covers at a flat rate. */
export function periodsCovered(amount: number, perPeriod: number): number {
  if (!Number.isFinite(perPeriod) || perPeriod <= 0) return 0;
  return Math.floor(amount / perPeriod);
}

/** Money is kept to the tetri, so float noise never decides a period. */
export const roundMoney = (value: number): number =>
  Math.round(value * 100) / 100;

export function evaluateSchedule(input: ScheduleInput): ScheduleStatus {
  const { period, graceDays } = input;
  const start = startOfDay(input.startDate);
  const end = startOfDay(input.endDate);
  const today = startOfDay(input.today);
  const amount = Number.isFinite(input.amount) && input.amount > 0 ? input.amount : 0;
  const credit =
    Number.isFinite(input.credit) && (input.credit ?? 0) > 0 ? roundMoney(input.credit!) : 0;

  // Never let paidThrough sit before the contract start or past its end,
  // and count only from a period boundary.
  const paidRaw = input.paidThrough ? startOfDay(input.paidThrough) : start;
  const firstIndex = boundaryIndexOnOrAfter(start, period, paidRaw);
  const boundary = periodBoundary(start, period, firstIndex);
  const paidThrough = boundary > end ? end : boundary;

  // The first unpaid period begins where payment stops — and payment is
  // due on that same day, because rent is collected up front.
  const nextDueDate = paidThrough;
  const daysOverdue = Math.max(
    0,
    Math.round((today.getTime() - nextDueDate.getTime()) / DAY_MS),
  );
  const graceEndsOn = addDays(nextDueDate, graceDays);
  const repossessFrom = addDays(graceEndsOn, 1);

  // Periods already due: every period that starts on or before today and
  // before the contract ends. Each is priced on its own start day, so a
  // holiday costs what the holiday costs rather than the base rate.
  let owed = 0;
  let gross = 0;
  for (let n = firstIndex; ; n += 1) {
    const periodStart = periodBoundary(start, period, n);
    if (periodStart >= end || periodStart > today) break;
    owed += 1;
    gross += input.rateFor ? input.rateFor(periodStart) : amount;
  }
  const amountDue = Math.max(0, roundMoney(gross - credit));

  let state: PaymentState;
  if (today < start) state = "not_started";
  else if (owed === 0) state = today >= end ? "ended" : "ok";
  else if (daysOverdue === 0) state = "due";
  else if (daysOverdue <= graceDays) state = "grace";
  else state = "repossess";

  return {
    period,
    state,
    nextDueDate,
    paidThrough,
    periodsOwed: owed,
    amountDue,
    credit,
    daysOverdue,
    graceDays,
    graceEndsOn,
    repossessFrom,
    canRepossess: state === "repossess",
  };
}
