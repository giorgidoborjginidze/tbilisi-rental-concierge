// One-off, idempotent repair of contracts written before the rent ledger
// was fixed (run by scripts/repair-ledger.ts, locally and on every deploy).
//
// A contract is "legacy" while openingAt is null: every contract written
// since has its ledger opened at creation. For each legacy contract:
//
//   1. Amounts. Until now the only amount field was labelled "monthly rent"
//      but charged per period, so for a daily or weekly contract
//      monthlyRent holds the day or week price. It becomes paymentAmount,
//      and monthlyRent becomes the monthly equivalent. A contract drawn on
//      the occupancy calendar of a daily-let asset was saved as "monthly"
//      although its amount is the night's price; a "monthly" contract of
//      under four weeks on such an asset is read as daily.
//   2. False debts. Every contract typed in used to start with paidThrough
//      = startDate ("nothing paid yet"), so a lease running since March was
//      213 days late the moment it was saved. A contract with no recorded
//      payment whose paidThrough is still its start date, and which started
//      before the repair day, is set back to untracked (paidThrough null):
//      the owner states "paid up to" once and tracking starts from there.
//   3. The ledger opens at the contract's current position (moved onto the
//      start-anchored period grid), so nothing already recorded changes.
//
// Pure: plans the change, the script writes it.

import { asPeriod, monthlyEquivalent } from "./amount";
import { contractPhase } from "./phase";
import { snapToBoundary, startOfDay, type PaymentPeriod } from "./schedule";

const DAY_MS = 86_400_000;

export interface LegacyContract {
  startDate: Date;
  endDate: Date;
  paymentPeriod: string;
  paymentAmount: number | null;
  monthlyRent: number;
  paidThrough: Date | null;
  creditBalance: number;
  openingAt: Date | null;
  paymentCount: number;
  asset: { rentalMode: string };
}

export interface ContractRepair {
  paymentPeriod: PaymentPeriod;
  paymentAmount: number;
  monthlyRent: number;
  paidThrough: Date | null;
  openingPaidThrough: Date | null;
  openingCredit: number;
  openingAt: Date;
  status: string;
  /** True when a false "unpaid since the start" debt was cleared. */
  untracked: boolean;
}

/** The repair for one contract, or null when it is already current. */
export function planContractRepair(
  contract: LegacyContract,
  repairDay: Date,
  now: Date,
): ContractRepair | null {
  if (contract.openingAt) return null;

  const start = startOfDay(contract.startDate);
  const end = startOfDay(contract.endDate);
  const lengthDays = Math.round((end.getTime() - start.getTime()) / DAY_MS);

  let period = asPeriod(contract.paymentPeriod);
  const calendarStay =
    contract.asset.rentalMode === "daily" &&
    period === "monthly" &&
    contract.paymentAmount == null &&
    lengthDays < 28;
  if (calendarStay) period = "daily";

  const perPeriod =
    contract.paymentAmount != null && contract.paymentAmount > 0
      ? contract.paymentAmount
      : contract.monthlyRent;

  const falseDebt =
    contract.paymentCount === 0 &&
    contract.paidThrough != null &&
    startOfDay(contract.paidThrough).getTime() === start.getTime() &&
    start < startOfDay(repairDay);

  const paidThrough =
    contract.paidThrough && !falseDebt
      ? snapToBoundary(start, end, period, contract.paidThrough)
      : null;

  return {
    paymentPeriod: period,
    paymentAmount: perPeriod,
    monthlyRent: monthlyEquivalent(perPeriod, period),
    paidThrough,
    openingPaidThrough: paidThrough,
    openingCredit: Math.max(0, contract.creditBalance),
    openingAt: now,
    status: contractPhase(contract, repairDay),
    untracked: falseDebt,
  };
}
