// Rent amounts: what the renter pays per period, and what that comes to
// per month.
//
// The owner types the amount PER PAYMENT PERIOD — 60 a day for a taxi,
// 350 a week, 1,200 a month for a flat. That is what the schedule charges
// (RentalContract.paymentAmount). Every monthly figure in the app — the
// income KPIs, the income bars, the market comparison — reads the
// normalised monthly equivalent instead (RentalContract.monthlyRent), so a
// daily car is not counted as 60 a month nor a flat as 1,200 a day.
//
// Framework-free and pure.

import type { PaymentPeriod } from "./schedule";

/** Average days in a month (365.25 / 12). */
export const DAYS_PER_MONTH = 30.44;
/** Average weeks in a month (52.14 / 12). */
export const WEEKS_PER_MONTH = 4.345;

const DAY_MS = 86_400_000;

export const asPeriod = (value: string | null | undefined): PaymentPeriod =>
  value === "daily" || value === "weekly" ? value : "monthly";

/** Monthly equivalent of an amount charged per `period`, to the tetri. */
export function monthlyEquivalent(amount: number, period: PaymentPeriod): number {
  const factor =
    period === "daily" ? DAYS_PER_MONTH : period === "weekly" ? WEEKS_PER_MONTH : 1;
  return Math.round(amount * factor * 100) / 100;
}

export interface ContractAmounts {
  paymentPeriod: string;
  paymentAmount: number | null;
  monthlyRent: number;
}

/**
 * What the renter pays each period. Every contract written since the
 * amount became per-period has paymentAmount set. A row without it is from
 * before, when monthlyRent itself was charged per period — so that is what
 * it falls back to, and an unrepaired row is never charged a different
 * amount than it was (scripts/repair-ledger.ts fills paymentAmount in).
 */
export function perPeriodAmount(contract: ContractAmounts): number {
  if (contract.paymentAmount != null && contract.paymentAmount > 0) {
    return contract.paymentAmount;
  }
  return contract.monthlyRent;
}

/** The price of one day of the contract. */
export function perDayAmount(contract: ContractAmounts): number {
  const period = asPeriod(contract.paymentPeriod);
  const amount = perPeriodAmount(contract);
  if (period === "daily") return amount;
  if (period === "weekly") return Math.round((amount / 7) * 100) / 100;
  return Math.round((contract.monthlyRent / DAYS_PER_MONTH) * 100) / 100;
}

const overlapDays = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number => {
  const from = Math.max(aStart.getTime(), bStart.getTime());
  const to = Math.min(aEnd.getTime(), bEnd.getTime());
  return to > from ? Math.round((to - from) / DAY_MS) : 0;
};

/**
 * Rent a contract earns inside a window (e.g. one calendar month): the
 * days it covers there, priced by its own period. A one-night stay counts
 * one night, a lease that starts mid-month counts part of that month.
 */
export function contractIncomeInWindow(
  contract: ContractAmounts & { startDate: Date; endDate: Date },
  window: { start: Date; end: Date },
): number {
  const days = overlapDays(contract.startDate, contract.endDate, window.start, window.end);
  if (days === 0) return 0;
  const period = asPeriod(contract.paymentPeriod);
  if (period === "daily") return days * perPeriodAmount(contract);
  if (period === "weekly") return (days * perPeriodAmount(contract)) / 7;

  // Monthly rent is prorated by calendar month, so a whole month counts
  // exactly one month's rent however long the month is.
  let total = 0;
  let cursor = new Date(
    Date.UTC(window.start.getUTCFullYear(), window.start.getUTCMonth(), 1),
  );
  while (cursor < window.end) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const inMonth = overlapDays(
      contract.startDate,
      contract.endDate,
      new Date(Math.max(cursor.getTime(), window.start.getTime())),
      new Date(Math.min(next.getTime(), window.end.getTime())),
    );
    const monthDays = Math.round((next.getTime() - cursor.getTime()) / DAY_MS);
    total += (contract.monthlyRent * inMonth) / monthDays;
    cursor = next;
  }
  return total;
}
