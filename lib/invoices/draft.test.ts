import { describe, expect, it } from "vitest";
import { invoiceDraft, invoiceLabel, invoiceOverdue } from "./draft";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const contract = { startDate: d("2026-01-10"), endDate: d("2027-01-10"), paymentPeriod: "monthly" };

describe("invoice draft", () => {
  it("bills the rent owed now, over the periods it covers", () => {
    const draft = invoiceDraft(contract, { nextDueDate: d("2026-08-10"), periodsOwed: 2, amountDue: 1800, credit: 0 }, 900);
    expect(draft).toEqual({ periodStart: d("2026-08-10"), periodEnd: d("2026-10-10"), amount: 1800, dueDate: d("2026-08-10") });
  });

  it("otherwise bills the next period, less credit already paid", () => {
    const draft = invoiceDraft(contract, { nextDueDate: d("2026-10-10"), periodsOwed: 0, amountDue: 0, credit: 150 }, 900);
    expect(draft.amount).toBe(750);
    expect(draft.periodEnd).toEqual(d("2026-11-10"));
  });

  it("never runs past the contract's end", () => {
    const draft = invoiceDraft(
      { ...contract, endDate: d("2026-10-25") },
      { nextDueDate: d("2026-10-10"), periodsOwed: 0, amountDue: 0, credit: 0 },
      900,
    );
    expect(draft.periodEnd).toEqual(d("2026-10-25"));
  });

  it("numbers by year and running count; knows overdue", () => {
    expect(invoiceLabel(7, d("2026-10-01"))).toBe("2026-0007");
    expect(invoiceOverdue({ status: "issued", dueDate: d("2026-09-30") }, d("2026-10-01"))).toBe(true);
    expect(invoiceOverdue({ status: "paid", dueDate: d("2026-09-30") }, d("2026-10-01"))).toBe(false);
  });
});
