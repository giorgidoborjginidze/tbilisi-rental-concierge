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
