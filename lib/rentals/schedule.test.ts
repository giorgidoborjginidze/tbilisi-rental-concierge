import { describe, expect, it } from "vitest";
import {
  addPeriods,
  advancePaidThrough,
  evaluateSchedule,
  periodsBetween,
  periodsCovered,
} from "./schedule";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

const base = {
  startDate: d("2026-01-01"),
  endDate: d("2027-01-01"),
  amount: 100,
  graceDays: 3,
};

describe("addPeriods", () => {
  it("clamps the day of month instead of overflowing", () => {
    expect(addPeriods(d("2026-01-31"), "monthly", 1)).toEqual(d("2026-02-28"));
    expect(addPeriods(d("2026-01-15"), "weekly", 2)).toEqual(d("2026-01-29"));
    expect(addPeriods(d("2026-01-15"), "daily", 5)).toEqual(d("2026-01-20"));
  });
});

describe("periodsBetween", () => {
  it("counts only whole periods", () => {
    expect(periodsBetween(d("2026-01-01"), d("2026-01-10"), "daily")).toBe(9);
    expect(periodsBetween(d("2026-01-01"), d("2026-01-20"), "weekly")).toBe(2);
    expect(periodsBetween(d("2026-01-31"), d("2026-02-27"), "monthly")).toBe(0);
    expect(periodsBetween(d("2026-01-31"), d("2026-02-28"), "monthly")).toBe(1);
  });

  it("never goes negative", () => {
    expect(periodsBetween(d("2026-05-01"), d("2026-01-01"), "daily")).toBe(0);
  });
});

describe("evaluateSchedule — daily rentals", () => {
  it("is ok on the day a period is paid up to the future", () => {
    const status = evaluateSchedule({
      ...base,
      period: "daily",
      paidThrough: d("2026-01-06"),
      today: d("2026-01-05"),
    });
    expect(status.state).toBe("ok");
    expect(status.periodsOwed).toBe(0);
    expect(status.amountDue).toBe(0);
    expect(status.daysOverdue).toBe(0);
  });

  it("marks the due day itself as due, not late", () => {
    const status = evaluateSchedule({
      ...base,
      period: "daily",
      paidThrough: d("2026-01-05"),
      today: d("2026-01-05"),
    });
    expect(status.state).toBe("due");
    expect(status.periodsOwed).toBe(1);
    expect(status.amountDue).toBe(100);
    expect(status.daysOverdue).toBe(0);
  });

  it("stays in grace through the third late day", () => {
    for (const [today, expected] of [
      ["2026-01-06", "grace"],
      ["2026-01-07", "grace"],
      ["2026-01-08", "grace"],
    ] as const) {
      const status = evaluateSchedule({
        ...base,
        period: "daily",
        paidThrough: d("2026-01-05"),
        today: d(today),
      });
      expect(status.state, today).toBe(expected);
      expect(status.canRepossess, today).toBe(false);
    }
  });

  it("grants the repossession right on the fourth day", () => {
    const status = evaluateSchedule({
      ...base,
      period: "daily",
      paidThrough: d("2026-01-05"),
      today: d("2026-01-09"),
    });
    expect(status.daysOverdue).toBe(4);
    expect(status.state).toBe("repossess");
    expect(status.canRepossess).toBe(true);
    expect(status.graceEndsOn).toEqual(d("2026-01-08"));
    expect(status.repossessFrom).toEqual(d("2026-01-09"));
    // Four unpaid days: the 5th through the 8th, plus today.
    expect(status.periodsOwed).toBe(5);
    expect(status.amountDue).toBe(500);
  });
});

describe("evaluateSchedule — weekly and monthly", () => {
  it("accrues one weekly period per week of delay", () => {
    const status = evaluateSchedule({
      ...base,
      period: "weekly",
      amount: 700,
      paidThrough: d("2026-03-02"),
      today: d("2026-03-16"),
    });
    expect(status.periodsOwed).toBe(3);
    expect(status.amountDue).toBe(2100);
    expect(status.daysOverdue).toBe(14);
    expect(status.state).toBe("repossess");
  });

  it("treats a monthly contract paid ahead as ok", () => {
    const status = evaluateSchedule({
      ...base,
      period: "monthly",
      amount: 1200,
      paidThrough: d("2026-06-01"),
      today: d("2026-04-20"),
    });
    expect(status.state).toBe("ok");
    expect(status.nextDueDate).toEqual(d("2026-06-01"));
  });
});

describe("evaluateSchedule — contract boundaries", () => {
  it("reports not_started before the contract begins", () => {
    const status = evaluateSchedule({
      ...base,
      period: "daily",
      paidThrough: null,
      today: d("2025-12-20"),
    });
    expect(status.state).toBe("not_started");
    expect(status.nextDueDate).toEqual(d("2026-01-01"));
  });

  it("stops accruing once the contract has ended and is settled", () => {
    const status = evaluateSchedule({
      ...base,
      period: "monthly",
      endDate: d("2026-04-01"),
      paidThrough: d("2026-04-01"),
      today: d("2026-06-01"),
    });
    expect(status.state).toBe("ended");
    expect(status.periodsOwed).toBe(0);
  });

  it("never charges for periods beyond the contract end", () => {
    const status = evaluateSchedule({
      ...base,
      period: "daily",
      endDate: d("2026-01-10"),
      paidThrough: d("2026-01-08"),
      today: d("2026-02-01"),
    });
    // Only the 8th and the 9th remain — the contract ends on the 10th.
    expect(status.periodsOwed).toBe(2);
    expect(status.amountDue).toBe(200);
    expect(status.state).toBe("repossess");
  });
});

describe("recording payments", () => {
  it("advances paidThrough by whole periods", () => {
    expect(
      advancePaidThrough(d("2026-01-05"), d("2026-01-01"), "daily", 3),
    ).toEqual(d("2026-01-08"));
    expect(advancePaidThrough(null, d("2026-01-01"), "monthly", 2)).toEqual(
      d("2026-03-01"),
    );
  });

  it("converts an amount into the periods it covers", () => {
    expect(periodsCovered(350, 100)).toBe(3);
    expect(periodsCovered(90, 100)).toBe(0);
    expect(periodsCovered(100, 0)).toBe(0);
  });
});
