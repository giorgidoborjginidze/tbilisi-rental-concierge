// A rental contract as the owner types it — on the contract form, the
// "tenant & rent" step of a new asset, and the contract edit form. One
// parser, so the three can never accept different things, and the pure
// rule for what editing an existing contract does to its payment ledger.
// Framework-free; no database.

import type { StringKey } from "@/lib/i18n/strings";
import { asPeriod, monthlyEquivalent, perPeriodAmount } from "./amount";
import { alignPaidThrough, restatesBalance } from "./ledger";
import { defaultPaidThrough, snapToBoundary, type PaymentPeriod } from "./schedule";

export interface ContractInput {
  tenantName: string | null;
  tenantPhone: string | null;
  startDate: Date;
  /** Exclusive: the move-out day. */
  endDate: Date;
  paymentPeriod: PaymentPeriod;
  /** What the renter pays per period, as agreed. */
  amount: number;
  monthlyRent: number;
  graceDays: number;
  deposit: number | null;
  notes: string | null;
  /** "Paid up to" as typed ("" when left empty) and snapped onto the grid. */
  paidRaw: string;
  paidThrough: Date | null;
  /** null: the form had no reminders checkbox (keep what is stored / on). */
  remindersEnabled: boolean | null;
  /** The renter agreed to WhatsApp notices; null: not on the form. */
  waConsent: boolean | null;
  /** The renter asked for no more messages; null: not on the form. */
  messagesOptOut: boolean | null;
}

/**
 * A yes/no that the contract stores as "since when" (consent given,
 * objection made): keeps the first date while it stays ticked, clears it
 * when unticked, and leaves it alone when the form had no such box.
 */
export function stampedFlag(ticked: boolean | null, stored: Date | null, now: Date): Date | null {
  if (ticked == null) return stored;
  if (!ticked) return null;
  return stored ?? now;
}

/** Reads one submitted field (trimmed, "" when absent). */
export type FieldReader = (key: string) => string;

const dateOf = (raw: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Parse the contract fields. `has` says whether a field was on the form at
 * all (the reminders checkbox sends nothing when unticked, so the form
 * also posts "remindersField").
 */
export function parseContractInput(
  get: FieldReader,
  has: (key: string) => boolean,
): { error: StringKey } | { value: ContractInput } {
  const startRaw = get("startDate");
  const endRaw = get("endDate");
  // "amount" is the per-period rent; older clients posted "monthlyRent".
  const amountRaw = get("amount") || get("monthlyRent");
  if (!startRaw || !endRaw || !amountRaw) return { error: "error_required" };

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "error_invalid_number" };

  const startDate = dateOf(startRaw);
  const endDate = dateOf(endRaw);
  if (!startDate || !endDate) return { error: "error_required" };
  if (endDate <= startDate) return { error: "error_contract_dates" };

  const depositRaw = get("deposit");
  const deposit = depositRaw ? Number(depositRaw) : null;
  if (deposit != null && (!Number.isFinite(deposit) || deposit < 0)) {
    return { error: "error_invalid_number" };
  }

  const graceRaw = get("graceDays");
  const graceNumber = graceRaw ? Number(graceRaw) : 3;
  if (!Number.isFinite(graceNumber) || graceNumber < 0 || graceNumber > 60) {
    return { error: "error_invalid_number" };
  }

  const paymentPeriod = asPeriod(get("paymentPeriod"));
  const paidRaw = get("paidThrough");
  let paidThrough: Date | null = null;
  if (paidRaw) {
    const typed = dateOf(paidRaw);
    if (!typed) return { error: "error_required" };
    paidThrough = snapToBoundary(startDate, endDate, paymentPeriod, typed);
  }

  return {
    value: {
      tenantName: get("tenantName") || null,
      tenantPhone: get("tenantPhone") || null,
      startDate,
      endDate,
      paymentPeriod,
      amount,
      monthlyRent: monthlyEquivalent(amount, paymentPeriod),
      graceDays: Math.round(graceNumber),
      deposit,
      notes: get("notes") || null,
      paidRaw,
      paidThrough,
      remindersEnabled: has("remindersField") ? get("remindersEnabled") === "on" : null,
      waConsent: has("messagesField") ? get("waConsent") === "on" : null,
      messagesOptOut: has("messagesField") ? get("messagesOptOut") === "on" : null,
    },
  };
}

/**
 * The paid-up-to date a NEW contract starts from: the typed date on the
 * contract's due dates, or — when nothing is typed — the first due date on
 * or after today, so a lease that has run since March is not announced as
 * seven months late the moment it is typed in.
 */
export const startingPaidThrough = (input: ContractInput, today: Date): Date =>
  input.paidThrough ??
  defaultPaidThrough(input.startDate, input.endDate, input.paymentPeriod, today);

interface StoredContract {
  startDate: Date;
  endDate: Date;
  paymentPeriod: string;
  paymentAmount: number | null;
  monthlyRent: number;
  paidThrough: Date | null;
  creditBalance: number;
}

export interface LedgerChange {
  paidThrough: Date | null;
  creditBalance: number;
  openingPaidThrough: Date | null;
  openingCredit: number;
  openingAt: Date;
}

/**
 * What editing a contract does to its payment ledger (null: nothing).
 *
 * - The owner changed "paid up to" on the form (it differs from what the
 *   form showed, `shownPaid`): the balance is restated — paid up to that
 *   date, no credit — and a new ledger balance opens.
 * - The start date, the period or the amount changed: the periods move
 *   onto a new grid and are priced anew. The same balance is carried over
 *   onto the new grid and a new balance opens, so a payment recorded
 *   before is never re-priced (it can no longer be taken back — as with
 *   a change of terms on the payment schedule).
 * - Only the end date changed (a lease extended or cut short): the
 *   periods keep their prices; the balance stays unless it now lies past
 *   the new end, where it is clamped.
 */
export function ledgerAfterEdit(
  stored: StoredContract,
  next: ContractInput,
  shownPaid: string | null,
  now: Date,
): LedgerChange | null {
  const terms = {
    startDate: next.startDate,
    endDate: next.endDate,
    period: next.paymentPeriod,
    amount: next.amount,
  };
  const stated = next.paidThrough;
  if (
    restatesBalance({ stored: stored.paidThrough, typed: next.paidRaw, shown: shownPaid, stated })
  ) {
    return {
      paidThrough: stated,
      creditBalance: 0,
      openingPaidThrough: stated,
      openingCredit: 0,
      openingAt: now,
    };
  }
  const regridded =
    stored.startDate.getTime() !== next.startDate.getTime() ||
    asPeriod(stored.paymentPeriod) !== next.paymentPeriod ||
    Math.abs(perPeriodAmount(stored) - next.amount) >= 0.005;
  const pastEnd =
    stored.paidThrough != null && stored.paidThrough.getTime() > next.endDate.getTime();
  const endMoved = stored.endDate.getTime() !== next.endDate.getTime();
  if (!regridded && !(endMoved && pastEnd)) return null;
  const paidThrough = stored.paidThrough ? alignPaidThrough(terms, stored.paidThrough) : null;
  return {
    paidThrough,
    creditBalance: stored.creditBalance,
    openingPaidThrough: paidThrough,
    openingCredit: stored.creditBalance,
    openingAt: now,
  };
}
