import { describe, expect, it } from "vitest";
import { ledgerAfterEdit, parseContractInput, startingPaidThrough, type ContractInput } from "./contract-input";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

const form = (fields: Record<string, string>) => ({
  get: (key: string) => (fields[key] ?? "").trim(),
  has: (key: string) => key in fields,
});

const parse = (fields: Record<string, string>) => {
  const f = form(fields);
  return parseContractInput(f.get, f.has);
};

const ok = (fields: Record<string, string>): ContractInput => {
  const result = parse(fields);
  if ("error" in result) throw new Error(result.error);
  return result.value;
};

const base = {
  tenantName: "Nino",
  tenantPhone: "+995 555 12 34 56",
  paymentPeriod: "monthly",
  amount: "1400",
  startDate: "2026-03-01",
  endDate: "2027-03-01",
};

describe("parseContractInput", () => {
  it("reads a monthly lease with its monthly figure", () => {
    const value = ok(base);
    expect(value).toMatchObject({
      tenantName: "Nino",
      paymentPeriod: "monthly",
      amount: 1400,
      monthlyRent: 1400,
      graceDays: 3,
      deposit: null,
      paidThrough: null,
      remindersEnabled: null,
    });
    expect(value.startDate).toEqual(d("2026-03-01"));
  });

  it("refuses what the old form refused: missing dates or amount, end before start, bad numbers", () => {
    expect(parse({ ...base, startDate: "" })).toEqual({ error: "error_required" });
    expect(parse({ ...base, amount: "" })).toEqual({ error: "error_required" });
    expect(parse({ ...base, amount: "-5" })).toEqual({ error: "error_invalid_number" });
    expect(parse({ ...base, endDate: "2026-02-01" })).toEqual({ error: "error_dates" });
    expect(parse({ ...base, endDate: "2026-03-01" })).toEqual({ error: "error_dates" });
    expect(parse({ ...base, deposit: "abc" })).toEqual({ error: "error_invalid_number" });
    expect(parse({ ...base, graceDays: "90" })).toEqual({ error: "error_invalid_number" });
    expect(parse({ ...base, startDate: "03/01/2026" })).toEqual({ error: "error_required" });
  });

  it("snaps a typed paid-up-to date onto the contract's due dates", () => {
    expect(ok({ ...base, paidThrough: "2026-09-15" }).paidThrough).toEqual(d("2026-10-01"));
  });

  it("the reminders box: absent form field → null, unticked → false, ticked → true", () => {
    expect(ok(base).remindersEnabled).toBeNull();
    expect(ok({ ...base, remindersField: "1" }).remindersEnabled).toBe(false);
    expect(ok({ ...base, remindersField: "1", remindersEnabled: "on" }).remindersEnabled).toBe(true);
  });

  it("a daily contract keeps the day price and a normalised month", () => {
    const value = ok({ ...base, paymentPeriod: "daily", amount: "60" });
    expect(value.amount).toBe(60);
    expect(value.monthlyRent).toBeCloseTo(60 * 30.44);
  });

  it("a new contract with nothing typed starts in good standing (next due date on or after today)", () => {
    expect(startingPaidThrough(ok(base), d("2026-09-30"))).toEqual(d("2026-10-01"));
    expect(startingPaidThrough(ok({ ...base, paidThrough: "2026-06-01" }), d("2026-09-30"))).toEqual(
      d("2026-06-01"),
    );
  });
});

describe("ledgerAfterEdit (what editing a contract does to the rent ledger)", () => {
  const stored = {
    startDate: d("2026-03-01"),
    endDate: d("2027-03-01"),
    paymentPeriod: "monthly",
    paymentAmount: 1400,
    monthlyRent: 1400,
    paidThrough: d("2026-10-01"),
    creditBalance: 200,
  };
  const now = d("2026-09-30");

  it("a new phone number or tenant name leaves the ledger alone", () => {
    const next = ok({ ...base, tenantPhone: "+995 599 00 00 00", paidThrough: "2026-10-01" });
    expect(ledgerAfterEdit(stored, next, "2026-10-01", now)).toBeNull();
  });

  it("changing paid-up-to on the form restates the balance (no credit)", () => {
    const next = ok({ ...base, paidThrough: "2026-12-01" });
    expect(ledgerAfterEdit(stored, next, "2026-10-01", now)).toEqual({
      paidThrough: d("2026-12-01"),
      creditBalance: 0,
      openingPaidThrough: d("2026-12-01"),
      openingCredit: 0,
      openingAt: now,
    });
  });

  it("a new amount carries the same balance (and credit) onto a new ledger opening", () => {
    const next = ok({ ...base, amount: "1500", paidThrough: "2026-10-01" });
    expect(ledgerAfterEdit(stored, next, "2026-10-01", now)).toEqual({
      paidThrough: d("2026-10-01"),
      creditBalance: 200,
      openingPaidThrough: d("2026-10-01"),
      openingCredit: 200,
      openingAt: now,
    });
  });

  it("a moved start date re-grids the balance onto the new due dates", () => {
    const next = ok({ ...base, startDate: "2026-03-15", paidThrough: "2026-10-01" });
    const change = ledgerAfterEdit(stored, next, "2026-10-01", now);
    expect(change?.paidThrough).toEqual(d("2026-10-15"));
  });

  it("an extended lease keeps its balance; one cut before the paid date is clamped", () => {
    expect(
      ledgerAfterEdit(stored, ok({ ...base, endDate: "2027-09-01", paidThrough: "2026-10-01" }), "2026-10-01", now),
    ).toBeNull();
    const cut = ledgerAfterEdit(
      stored,
      ok({ ...base, endDate: "2026-08-01", paidThrough: "2026-10-01" }),
      "2026-10-01",
      now,
    );
    expect(cut?.paidThrough).toEqual(d("2026-08-01"));
  });
});
