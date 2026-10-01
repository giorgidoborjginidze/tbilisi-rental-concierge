// What a new invoice for a contract says before the owner touches it: the
// rent owed now, or else the next period's rent — the same amounts the
// rental desk and the WhatsApp reminders use (lib/rentals/terms.ts). Pure.

import { addPeriods, type ScheduleStatus } from "@/lib/rentals/schedule";
import { asPeriod } from "@/lib/rentals/amount";

export interface InvoiceDraft {
  periodStart: Date;
  /** Exclusive, like a contract's end. */
  periodEnd: Date;
  amount: number;
  dueDate: Date;
}

export function invoiceDraft(
  contract: { startDate: Date; endDate: Date; paymentPeriod: string },
  status: Pick<ScheduleStatus, "nextDueDate" | "periodsOwed" | "amountDue" | "credit">,
  /** One period's rent (lib/rentals/terms.ts periodAmount). */
  periodRent: number,
): InvoiceDraft {
  const period = asPeriod(contract.paymentPeriod);
  const start = status.nextDueDate;
  const owed = status.periodsOwed > 0;
  const periods = owed ? status.periodsOwed : 1;
  const end = addPeriods(start, period, periods);
  return {
    periodStart: start,
    periodEnd: end > contract.endDate ? contract.endDate : end,
    amount: owed ? status.amountDue : Math.max(0, Math.round((periodRent - status.credit) * 100) / 100),
    dueDate: start,
  };
}

/** "2026-0007": the year it was issued and the account's running number. */
export function invoiceLabel(number: number, issuedAt: Date): string {
  return `${issuedAt.getUTCFullYear()}-${String(number).padStart(4, "0")}`;
}

export const INVOICE_STATUSES = ["issued", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Issued and not paid, with its due date behind it. */
export const invoiceOverdue = (
  invoice: { status: string; dueDate: Date | null },
  today: Date,
): boolean => invoice.status === "issued" && invoice.dueDate != null && invoice.dueDate < today;
