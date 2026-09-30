// The rent ledger: how money received moves the payment schedule.
//
//   - Money pays owed periods in order, each priced with the SAME rate the
//     schedule uses to show what is due (weekend and holiday days
//     included), so paying the amount on screen settles exactly the
//     periods on screen — no more, no less.
//   - Whatever does not cover a whole period is kept as credit and counts
//     toward the next one. A part payment therefore leaves the contract
//     exactly as late as it was, and the money is not lost either.
//   - Deleting a payment replays the remaining ones from the ledger's
//     opening balance, so periods paid by later payments never re-open.
//
// Framework-free and pure: no database.

import {
  boundaryIndexOnOrAfter,
  periodBoundary,
  roundMoney,
  startOfDay,
  type PaymentPeriod,
} from "./schedule";

export interface LedgerTerms {
  startDate: Date;
  /** Exclusive end of the contract. */
  endDate: Date;
  period: PaymentPeriod;
  /** Flat amount per period. */
  amount: number;
  /** Per-period price (daily lets with weekend/holiday premiums). */
  rateFor?: (periodStart: Date) => number;
}

export interface LedgerState {
  /** Paid up to (exclusive), a period boundary. */
  paidThrough: Date;
  /** Money held toward the next period. */
  credit: number;
}

export interface AppliedPayment {
  /** Where the payment started paying (the first period it touched). */
  periodStart: Date;
  /** Paid up to after this payment. Equal to periodStart = kept as credit. */
  periodEnd: Date;
  /** Whole periods this payment (with earlier credit) settled. */
  covered: number;
  state: LedgerState;
}

/** The price of the period starting on `periodStart`. */
export function periodRate(terms: LedgerTerms, periodStart: Date): number {
  const rate = terms.rateFor ? terms.rateFor(periodStart) : terms.amount;
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/** Bring a stored paid-up-to date onto the contract's period grid. */
export function alignPaidThrough(terms: LedgerTerms, paidThrough: Date): Date {
  const start = startOfDay(terms.startDate);
  const end = startOfDay(terms.endDate);
  const date = startOfDay(paidThrough);
  if (date <= start) return start;
  if (date >= end) return end;
  const boundary = periodBoundary(
    start,
    terms.period,
    boundaryIndexOnOrAfter(start, terms.period, date),
  );
  return boundary > end ? end : boundary;
}

/**
 * Apply one payment to the ledger. Walks the owed periods from the current
 * paid-up-to date, paying each in full while the money lasts; the rest
 * stays as credit. Money beyond the end of the contract is credit too.
 */
export function applyPayment(
  terms: LedgerTerms,
  state: LedgerState,
  amount: number,
): AppliedPayment {
  const start = startOfDay(terms.startDate);
  const end = startOfDay(terms.endDate);
  let paidThrough = alignPaidThrough(terms, state.paidThrough);
  const periodStart = paidThrough;
  let money = roundMoney(Math.max(0, state.credit) + Math.max(0, amount));
  let covered = 0;

  let n = boundaryIndexOnOrAfter(start, terms.period, paidThrough);
  while (paidThrough < end) {
    const rate = roundMoney(periodRate(terms, paidThrough));
    if (rate <= 0 || money < rate) break;
    money = roundMoney(money - rate);
    n += 1;
    const next = periodBoundary(start, terms.period, n);
    paidThrough = next > end ? end : next;
    covered += 1;
  }

  return {
    periodStart,
    periodEnd: paidThrough,
    covered,
    state: { paidThrough, credit: money },
  };
}

/**
 * Rebuild the ledger from its opening balance and the payments recorded
 * since, in the order they were recorded. Recording payments one by one
 * and replaying them give the same result, so a replay after a deletion
 * only ever changes what the deleted payment had changed.
 */
export function replayLedger(
  terms: LedgerTerms,
  opening: LedgerState,
  amounts: number[],
): { state: LedgerState; applied: AppliedPayment[] } {
  let state: LedgerState = {
    paidThrough: alignPaidThrough(terms, opening.paidThrough),
    credit: roundMoney(Math.max(0, opening.credit)),
  };
  const applied: AppliedPayment[] = [];
  for (const amount of amounts) {
    const step = applyPayment(terms, state, amount);
    applied.push(step);
    state = step.state;
  }
  return { state, applied };
}

/**
 * Is a saved "paid up to" a restatement of the balance? Only when the
 * owner changed the date on screen (`typed` differs from `shown`, what the
 * form displayed) and it lands somewhere other than the stored position.
 * A stale page, or a period switch that moves the unchanged date onto a
 * new grid, is not a restatement — the stored balance and credit carry
 * over. An untracked contract (nothing stored) is always stated.
 */
export function restatesBalance(input: {
  stored: Date | null;
  typed: string;
  shown: string | null;
  stated: Date | null;
}): boolean {
  if (!input.stated) return false;
  const touched = input.stored == null || input.shown == null || input.typed !== input.shown;
  return touched && input.stated.getTime() !== input.stored?.getTime();
}
