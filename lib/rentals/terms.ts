// A contract's payment terms in the form the schedule and the ledger
// read, plus the one call every screen uses to ask "where does this rent
// stand today". Pure — no database — so the monitor, the pages and the
// deploy-time repair all share it.

import { dayPrice } from "../assets/daily-price";
import { asPeriod, perPeriodAmount } from "./amount";
import type { LedgerTerms } from "./ledger";
import { evaluateSchedule, type ScheduleStatus } from "./schedule";

/** Per-period amount, as the renter pays it. */
export function periodAmount(contract: {
  paymentPeriod?: string;
  paymentAmount: number | null;
  monthlyRent: number;
}): number {
  return perPeriodAmount({
    paymentPeriod: contract.paymentPeriod ?? "monthly",
    paymentAmount: contract.paymentAmount,
    monthlyRent: contract.monthlyRent,
  });
}

/** The asset's daily-pricing rules, when it has any. */
export interface DailyPricing {
  dailyRate: number | null;
  weekendPct: number | null;
  holidayPct: number | null;
}

/**
 * Prices one day of a daily contract. Weekend and holiday premiums come
 * from the asset, so a public holiday is charged at the holiday rate
 * rather than the base one — which is the whole point of setting them.
 */
export function dailyRateFor(
  base: number,
  pricing?: DailyPricing | null,
): ((day: Date) => number) | undefined {
  if (!pricing) return undefined;
  const weekend = pricing.weekendPct ?? 0;
  const holiday = pricing.holidayPct ?? 0;
  if (weekend === 0 && holiday === 0) return undefined;
  return (day) => dayPrice(day, base, weekend, holiday);
}

export interface ContractTermsInput {
  startDate: Date;
  endDate: Date;
  paymentPeriod: string;
  paymentAmount: number | null;
  monthlyRent: number;
}

/**
 * The ledger's view of a contract — the same rates the schedule shows.
 * `pricing` is the asset's (weekend / holiday premiums). It is required, so
 * no screen can forget it and show a different amount than the WhatsApp
 * message; pass null only where the contract has no asset.
 */
export function contractTerms(
  contract: ContractTermsInput,
  pricing: DailyPricing | null,
): LedgerTerms {
  const period = asPeriod(contract.paymentPeriod);
  const amount = periodAmount(contract);
  return {
    startDate: contract.startDate,
    endDate: contract.endDate,
    period,
    amount,
    rateFor: period === "daily" ? dailyRateFor(amount, pricing) : undefined,
  };
}

/**
 * Where a contract's rent stands on `today` (a Tbilisi day, stored form —
 * lib/time.ts startOfTodayTbilisi). This is the one call every screen, the
 * alert scan and the WhatsApp reminders use, and the asset's pricing is a
 * required argument: a daily contract is charged the weekend / holiday
 * price on those days, so a caller that left it out would show a smaller
 * debt than the message the renter receives.
 */
export function statusFor(
  contract: ContractTermsInput & {
    graceDays: number;
    paidThrough: Date | null;
    creditBalance?: number | null;
  },
  today: Date,
  /** The asset's daily pricing (weekend / holiday premiums), or null. */
  pricing: DailyPricing | null,
): ScheduleStatus {
  const terms = contractTerms(contract, pricing);
  return evaluateSchedule({
    startDate: terms.startDate,
    endDate: terms.endDate,
    period: terms.period,
    amount: terms.amount,
    rateFor: terms.rateFor,
    graceDays: contract.graceDays,
    paidThrough: contract.paidThrough,
    credit: contract.creditBalance ?? 0,
    today,
  });
}
