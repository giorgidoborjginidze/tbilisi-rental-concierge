import { describe, expect, it } from "vitest";
import { applyPayment, replayLedger, type LedgerTerms } from "./ledger";
import { evaluateSchedule } from "./schedule";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

const daily: LedgerTerms = {
  startDate: d("2026-01-01"),
  endDate: d("2027-01-01"),
  period: "daily",
  amount: 100,
};

describe("part payments", () => {
  it("keep the contract exactly as late as it was and hold the money as credit", () => {
    const step = applyPayment(daily, { paidThrough: d("2026-01-05"), credit: 0 }, 10);
    expect(step.covered).toBe(0);
    expect(step.periodStart).toEqual(d("2026-01-05"));
    expect(step.periodEnd).toEqual(d("2026-01-05"));
    expect(step.state).toEqual({ paidThrough: d("2026-01-05"), credit: 10 });

    const status = evaluateSchedule({
      ...daily,
      graceDays: 3,
      paidThrough: step.state.paidThrough,
      credit: step.state.credit,
      today: d("2026-01-09"),
    });
    // Still four days late — the repossession right is not bought off.
    expect(status.daysOverdue).toBe(4);
    expect(status.state).toBe("repossess");
    expect(status.amountDue).toBe(490);
  });

  it("add up: the credit counts toward the next period", () => {
    const first = applyPayment(daily, { paidThrough: d("2026-01-05"), credit: 0 }, 10);
    const second = applyPayment(daily, first.state, 95);
    expect(second.covered).toBe(1);
    expect(second.state).toEqual({ paidThrough: d("2026-01-06"), credit: 5 });
  });

  it("ten payments of 1 GEL on a 90 GEL day never clear a day", () => {
    const terms: LedgerTerms = { ...daily, amount: 90 };
    let state = { paidThrough: d("2026-01-20"), credit: 0 };
    for (let i = 0; i < 10; i += 1) state = applyPayment(terms, state, 1).state;
    expect(state).toEqual({ paidThrough: d("2026-01-20"), credit: 10 });
  });
});

describe("whole and extra money", () => {
  it("covers whole periods and keeps the rest", () => {
    const step = applyPayment(daily, { paidThrough: d("2026-01-05"), credit: 0 }, 350);
    expect(step.covered).toBe(3);
    expect(step.state).toEqual({ paidThrough: d("2026-01-08"), credit: 50 });
  });

  it("stops at the contract end and keeps the overpayment as credit", () => {
    const terms: LedgerTerms = { ...daily, endDate: d("2026-01-10") };
    const step = applyPayment(terms, { paidThrough: d("2026-01-08"), credit: 0 }, 500);
    expect(step.covered).toBe(2);
    expect(step.state).toEqual({ paidThrough: d("2026-01-10"), credit: 300 });
  });

  it("never loops on a period without a price", () => {
    const step = applyPayment(
      { ...daily, amount: 0 },
      { paidThrough: d("2026-01-05"), credit: 0 },
      100,
    );
    expect(step.covered).toBe(0);
    expect(step.state.credit).toBe(100);
  });
});

describe("the same rate as the amount shown", () => {
  // Weekend and holiday days cost more; 1–2 January are holidays.
  const priced: LedgerTerms = {
    ...daily,
    startDate: d("2025-12-01"),
    rateFor: (day) => {
      const key = day.toISOString().slice(5, 10);
      return key === "01-01" || key === "01-02" ? 200 : 100;
    },
  };

  it("paying exactly the amount due settles exactly the owed days", () => {
    const opening = { paidThrough: d("2025-12-31"), credit: 0 };
    const before = evaluateSchedule({
      ...priced,
      graceDays: 3,
      paidThrough: opening.paidThrough,
      today: d("2026-01-03"),
    });
    expect(before.periodsOwed).toBe(4);
    expect(before.amountDue).toBe(600);

    const step = applyPayment(priced, opening, before.amountDue);
    expect(step.covered).toBe(4);
    expect(step.state).toEqual({ paidThrough: d("2026-01-04"), credit: 0 });
  });

  it("does not hand out a free day for a holiday paid at the base rate", () => {
    const step = applyPayment(priced, { paidThrough: d("2025-12-31"), credit: 0 }, 400);
    // 31 Dec (100) + 1 Jan (200) = 300; 2 Jan (200) is not covered by 100.
    expect(step.covered).toBe(2);
    expect(step.state).toEqual({ paidThrough: d("2026-01-02"), credit: 100 });
  });
});

describe("monthly periods through the ledger", () => {
  it("pays 31 Jan → 28 Feb → 31 Mar → 30 Apr, never drifting to the 28th", () => {
    const terms: LedgerTerms = {
      startDate: d("2026-01-31"),
      endDate: d("2027-01-31"),
      period: "monthly",
      amount: 1200,
    };
    let state = { paidThrough: d("2026-01-31"), credit: 0 };
    const ends: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      state = applyPayment(terms, state, 1200).state;
      ends.push(state.paidThrough.toISOString().slice(0, 10));
    }
    expect(ends).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });
});

describe("replaying the ledger", () => {
  const weekly: LedgerTerms = {
    startDate: d("2026-09-01"),
    endDate: d("2027-09-01"),
    period: "weekly",
    amount: 350,
  };
  const opening = { paidThrough: d("2026-09-01"), credit: 0 };

  it("gives the same result as recording the payments one by one", () => {
    const amounts = [350, 100, 300, 700];
    let state = opening;
    for (const amount of amounts) state = applyPayment(weekly, state, amount).state;
    expect(replayLedger(weekly, opening, amounts).state).toEqual(state);
  });

  it("deleting an older payment never re-opens what later payments paid", () => {
    const all = replayLedger(weekly, opening, [350, 350, 350]);
    expect(all.state.paidThrough).toEqual(d("2026-09-22"));

    // The first payment is removed: the two that remain still pay two weeks.
    const after = replayLedger(weekly, opening, [350, 350]);
    expect(after.state).toEqual({ paidThrough: d("2026-09-15"), credit: 0 });
    expect(after.applied.map((step) => step.periodStart)).toEqual([
      d("2026-09-01"),
      d("2026-09-08"),
    ]);
  });

  it("starts from the opening balance the owner stated, credit included", () => {
    const replay = replayLedger(
      weekly,
      { paidThrough: d("2026-10-06"), credit: 50 },
      [300],
    );
    expect(replay.state).toEqual({ paidThrough: d("2026-10-13"), credit: 0 });
  });

  it("moves a legacy off-grid opening date onto the grid", () => {
    const replay = replayLedger(weekly, { paidThrough: d("2026-09-03"), credit: 0 }, []);
    expect(replay.state.paidThrough).toEqual(d("2026-09-08"));
  });
});
