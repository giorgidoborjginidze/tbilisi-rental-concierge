// A contract's payment terms in the form the schedule and the ledger
// read, plus the one call every screen uses to ask "where does this rent
// stand today". Pure — no database — so the monitor, the pages and the
// deploy-time repair all share it.

import { dayPrice } from "../assets/daily-price";
import { asPeriod, perPeriodAmount } from "./amount";
import type { LedgerTerms } from "./ledger";
import {
  boundaryIndexOnOrAfter,
  evaluateSchedule,
  periodBoundary,
  roundMoney,
  startOfDay,
  type ScheduleStatus,
} from "./schedule";
import { activeContract, contractPhase, scheduleContract } from "./phase";

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
    rateFor: period === "daily" ? dailyRateFor(amount, pricing) : partialLastPeriod(contract, period, amount),
  };
}

/**
 * A week or month cut short by the contract's end is charged for the days
 * it has, not as a whole period — the same nights the income figures count
 * (a 5-night "monthly" contract owes 5 nights, not the month). Undefined
 * when the contract ends on a period boundary (every period is whole).
 */
function partialLastPeriod(
  contract: { startDate: Date; endDate: Date },
  period: "weekly" | "monthly",
  amount: number,
): ((periodStart: Date) => number) | undefined {
  const start = startOfDay(contract.startDate);
  const end = startOfDay(contract.endDate);
  if (end <= start) return undefined;
  const last = boundaryIndexOnOrAfter(start, period, end);
  if (periodBoundary(start, period, last).getTime() === end.getTime()) return undefined;
  return (periodStart) => {
    const from = startOfDay(periodStart);
    const n = boundaryIndexOnOrAfter(start, period, from);
    const next = periodBoundary(start, period, n + 1);
    if (next <= end) return amount;
    const whole = next.getTime() - from.getTime();
    return whole > 0 ? roundMoney((amount * (end.getTime() - from.getTime())) / whole) : amount;
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

// ── Settling what a finished contract still owes ───────────────────────
//
// The monitor stops chasing a contract once it has ended — no reminders,
// no alerts. But rent left unpaid at the end is still money the renter
// owes, and when they pay it the owner must be able to record it. So the
// screens that take money (the rental page, the decide cards, the late
// badge on the asset list) still reach a finished contract while it has a
// balance.

/** How long after its end a finished contract's debt is still offered for settling on the dashboards. */
export const SETTLEMENT_WINDOW_DAYS = 90;

type SettlementInput = ContractTermsInput & {
  graceDays: number;
  paidThrough: Date | null;
  creditBalance?: number | null;
};

/** Does this contract still have rent owed on `today`? Untracked contracts never do. */
export function hasBalance(
  contract: SettlementInput,
  today: Date,
  pricing: DailyPricing | null,
): boolean {
  if (contract.paidThrough == null) return false;
  return statusFor(contract, today, pricing).periodsOwed > 0;
}

/**
 * Finished contracts that still have rent owed, the most recently ended
 * first. `withinDays` limits how far back to look.
 */
export function unsettledContracts<T extends SettlementInput>(
  contracts: T[],
  today: Date,
  pricing: DailyPricing | null,
  withinDays: number = Number.POSITIVE_INFINITY,
): T[] {
  const cutoff = today.getTime() - withinDays * 86_400_000;
  return contracts
    .filter(
      (contract) =>
        contractPhase(contract, today) === "ended" &&
        contract.endDate.getTime() > cutoff &&
        hasBalance(contract, today, pricing),
    )
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
}

/**
 * The contract whose money the owner deals with: the one running today or
 * next to start (scheduleContract), else the most recently finished one
 * that still has rent owed.
 */
export function settlementContract<T extends SettlementInput>(
  contracts: T[],
  today: Date,
  pricing: DailyPricing | null,
): T | undefined {
  return scheduleContract(contracts, today) ?? unsettledContracts(contracts, today, pricing)[0];
}

/**
 * The contract a "late" marker is about: the running one when it is late,
 * else the most recently finished one with rent still owed.
 */
export function lateContract<T extends SettlementInput>(
  contracts: T[],
  today: Date,
  pricing: DailyPricing | null,
  withinDays: number = SETTLEMENT_WINDOW_DAYS,
): T | undefined {
  const running = activeContract(contracts, today);
  if (running && running.paidThrough != null) {
    const state = statusFor(running, today, pricing).state;
    if (state === "due" || state === "grace" || state === "repossess") return running;
  }
  return unsettledContracts(contracts, today, pricing, withinDays)[0];
}
