// Payment schedule for a rental contract.
//
// Car rentals in Georgia are paid up front, per period: every day, every
// week or every month. The contract also names how many days late is
// still tolerated (typically 3). Once the delay passes that grace period —
// day 4 with graceDays = 3 — the owner has the contractual right to take
// the vehicle back. This module is the single place that decides that, so
// the alert scan, the WhatsApp messages and the UI can never disagree.
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
  endDate: Date;
  period: PaymentPeriod;
  /** Amount per period — the flat rate. */
  amount: number;
  /**
   * Optional per-period rate. Daily rentals charge more at weekends and
   * on public holidays, so what is owed is not simply periods × amount:
   * each period is priced on the day it starts.
   */
  rateFor?: (periodStart: Date) => number;
  /** Days of delay the contract tolerates before repossession. */
  graceDays: number;
  /** Paid up to (exclusive). Null = nothing paid yet. */
  paidThrough: Date | null;
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
  /** Sum of the rates of every owed period, holidays included. */
  amountDue: number;
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

/**
 * Where `paidThrough` moves to once `count` periods are paid. Used when
 * recording a payment so the schedule advances by whole periods only.
 */
export function advancePaidThrough(
  current: Date | null,
  startDate: Date,
  period: PaymentPeriod,
  count: number,
): Date {
  const from = current && current > startDate ? current : startDate;
  return addPeriods(startOfDay(from), period, Math.max(0, count));
}

/** How many whole periods an amount of money covers. */
export function periodsCovered(amount: number, perPeriod: number): number {
  if (!Number.isFinite(perPeriod) || perPeriod <= 0) return 0;
  return Math.floor(amount / perPeriod);
}

export function evaluateSchedule(input: ScheduleInput): ScheduleStatus {
  const { period, graceDays } = input;
  const start = startOfDay(input.startDate);
  const end = startOfDay(input.endDate);
  const today = startOfDay(input.today);
  const amount = Number.isFinite(input.amount) && input.amount > 0 ? input.amount : 0;

  // Never let paidThrough sit before the contract start or past its end.
  const paidRaw = input.paidThrough ? startOfDay(input.paidThrough) : start;
  const paidThrough = paidRaw < start ? start : paidRaw > end ? end : paidRaw;

  // The first unpaid period begins where payment stops — and payment is
  // due on that same day, because rent is collected up front.
  const nextDueDate = paidThrough;
  const daysOverdue = Math.max(
    0,
    Math.round((today.getTime() - nextDueDate.getTime()) / DAY_MS),
  );
  const graceEndsOn = addDays(nextDueDate, graceDays);
  const repossessFrom = addDays(graceEndsOn, 1);

  // Periods already due: every period that started on or before today,
  // capped at however many periods the contract still has left to run.
  let owed = 0;
  if (paidThrough < end && today >= paidThrough) {
    const due = periodsBetween(paidThrough, today, period) + 1;
    const whole = periodsBetween(paidThrough, end, period);
    const remaining =
      addPeriods(paidThrough, period, whole) >= end ? whole : whole + 1;
    owed = Math.min(due, remaining);
  }

  // Price each owed period on its own start day, so a holiday costs what
  // the holiday costs rather than the base rate.
  let amountDue = 0;
  for (let i = 0; i < owed; i += 1) {
    const periodStart = addPeriods(paidThrough, period, i);
    amountDue += input.rateFor ? input.rateFor(periodStart) : amount;
  }

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
    daysOverdue,
    graceDays,
    graceEndsOn,
    repossessFrom,
    canRepossess: state === "repossess",
  };
}
