import { describe, expect, it } from "vitest";
import {
  addPeriods,
  boundaryIndexOnOrAfter,
  defaultPaidThrough,
  evaluateSchedule,
  periodBoundary,
  periodsBetween,
  periodsCovered,
  snapToBoundary,
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
    // Weekly periods start on the contract's weekday: 1 Jan, 8 Jan, …
    const status = evaluateSchedule({
      ...base,
      period: "weekly",
      amount: 700,
      paidThrough: d("2026-02-26"),
      today: d("2026-03-12"),
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

describe("per-period pricing", () => {
  it("prices each owed day on its own rate rather than a flat average", () => {
    // 1–2 January are Georgian public holidays; charge double for them.
    const status = evaluateSchedule({
      ...base,
      period: "daily",
      amount: 100,
      paidThrough: d("2025-12-31"),
      today: d("2026-01-03"),
      startDate: d("2025-12-01"),
      rateFor: (day) => {
        const key = day.toISOString().slice(5, 10);
        return key === "01-01" || key === "01-02" ? 200 : 100;
      },
    });
    // 31 Dec (100) + 1 Jan (200) + 2 Jan (200) + 3 Jan (100).
    expect(status.periodsOwed).toBe(4);
    expect(status.amountDue).toBe(600);
  });

  it("falls back to the flat amount when no rate function is given", () => {
    const status = evaluateSchedule({
      ...base,
      period: "daily",
      amount: 100,
      paidThrough: d("2026-01-05"),
      today: d("2026-01-07"),
    });
    expect(status.periodsOwed).toBe(3);
    expect(status.amountDue).toBe(300);
  });
});

describe("periods anchored on the contract start", () => {
  it("computes every boundary from the start, so a short month never sticks", () => {
    const start = d("2026-01-31");
    expect(periodBoundary(start, "monthly", 1)).toEqual(d("2026-02-28"));
    expect(periodBoundary(start, "monthly", 2)).toEqual(d("2026-03-31"));
    expect(periodBoundary(start, "monthly", 3)).toEqual(d("2026-04-30"));
    expect(periodBoundary(start, "monthly", 4)).toEqual(d("2026-05-31"));
    expect(periodBoundary(d("2026-01-01"), "weekly", 2)).toEqual(d("2026-01-15"));
    expect(periodBoundary(d("2026-01-01"), "daily", 3)).toEqual(d("2026-01-04"));
  });

  it("finds the first boundary on or after a date", () => {
    const start = d("2026-01-31");
    expect(boundaryIndexOnOrAfter(start, "monthly", d("2026-01-31"))).toBe(0);
    expect(boundaryIndexOnOrAfter(start, "monthly", d("2026-02-28"))).toBe(1);
    expect(boundaryIndexOnOrAfter(start, "monthly", d("2026-03-01"))).toBe(2);
    expect(boundaryIndexOnOrAfter(start, "monthly", d("2026-03-31"))).toBe(2);
    expect(boundaryIndexOnOrAfter(d("2026-01-01"), "weekly", d("2026-01-09"))).toBe(2);
    expect(boundaryIndexOnOrAfter(d("2026-01-01"), "daily", d("2025-12-01"))).toBe(0);
  });

  it("falls due on the 31st in March for a lease started on 31 January", () => {
    const lease = {
      startDate: d("2026-01-31"),
      endDate: d("2027-01-31"),
      period: "monthly" as const,
      amount: 1200,
      graceDays: 3,
      paidThrough: d("2026-02-28"), // the first month paid
    };
    // The second month began on 28 February; the third begins on 31 March
    // — not on the 28th, which is where the old chained dates drifted to.
    const lateMarch = evaluateSchedule({ ...lease, today: d("2026-03-30") });
    expect(lateMarch.periodsOwed).toBe(1);
    const dueDay = evaluateSchedule({ ...lease, today: d("2026-03-31") });
    expect(dueDay.periodsOwed).toBe(2);

    const paidUp = evaluateSchedule({
      ...lease,
      paidThrough: d("2026-03-31"),
      today: d("2026-03-30"),
    });
    expect(paidUp.state).toBe("ok");
    expect(paidUp.nextDueDate).toEqual(d("2026-03-31"));
  });

  it("moves a drifted or hand-typed date up to the next boundary", () => {
    const status = evaluateSchedule({
      startDate: d("2026-01-31"),
      endDate: d("2027-01-31"),
      period: "monthly",
      amount: 1200,
      graceDays: 3,
      paidThrough: d("2026-03-28"), // the old code's drifted pointer
      today: d("2026-03-30"),
    });
    expect(status.nextDueDate).toEqual(d("2026-03-31"));
    expect(status.state).toBe("ok");
  });

  it("snaps a typed date onto the grid, inside the contract", () => {
    const start = d("2026-03-01");
    const end = d("2027-03-01");
    expect(snapToBoundary(start, end, "monthly", d("2026-09-30"))).toEqual(d("2026-10-01"));
    expect(snapToBoundary(start, end, "monthly", d("2026-10-01"))).toEqual(d("2026-10-01"));
    expect(snapToBoundary(start, end, "monthly", d("2025-01-01"))).toEqual(start);
    expect(snapToBoundary(start, end, "monthly", d("2030-01-01"))).toEqual(end);
  });
});

describe("default paid-up-to for a newly entered contract", () => {
  it("puts a lease that is already running in good standing", () => {
    // Nino's flat: 1 March lease entered on 30 September.
    const paid = defaultPaidThrough(
      d("2026-03-01"), d("2027-03-01"), "monthly", d("2026-09-30"),
    );
    expect(paid).toEqual(d("2026-10-01"));
    const status = evaluateSchedule({
      startDate: d("2026-03-01"),
      endDate: d("2027-03-01"),
      period: "monthly",
      amount: 1200,
      graceDays: 3,
      paidThrough: paid,
      today: d("2026-09-30"),
    });
    expect(status.state).toBe("ok");
    expect(status.amountDue).toBe(0);
  });

  it("shows a payment falling due today as due, not late", () => {
    const paid = defaultPaidThrough(
      d("2026-09-28"), d("2027-09-28"), "daily", d("2026-09-30"),
    );
    expect(paid).toEqual(d("2026-09-30"));
    const status = evaluateSchedule({
      startDate: d("2026-09-28"),
      endDate: d("2027-09-28"),
      period: "daily",
      amount: 60,
      graceDays: 3,
      paidThrough: paid,
      today: d("2026-09-30"),
    });
    expect(status.state).toBe("due");
    expect(status.daysOverdue).toBe(0);
  });

  it("counts a contract that has not started from its first day", () => {
    expect(
      defaultPaidThrough(d("2026-10-05"), d("2026-11-05"), "weekly", d("2026-09-30")),
    ).toEqual(d("2026-10-05"));
  });

  it("treats a stay that is already over as settled", () => {
    expect(
      defaultPaidThrough(d("2026-09-01"), d("2026-09-04"), "daily", d("2026-09-30")),
    ).toEqual(d("2026-09-04"));
  });
});

describe("credit toward the next period", () => {
  it("lowers what is still to pay without moving the schedule", () => {
    const status = evaluateSchedule({
      ...base,
      period: "daily",
      paidThrough: d("2026-01-05"),
      credit: 10,
      today: d("2026-01-07"),
    });
    expect(status.periodsOwed).toBe(3);
    expect(status.amountDue).toBe(290);
    expect(status.credit).toBe(10);
    expect(status.daysOverdue).toBe(2);
    expect(status.state).toBe("grace");
  });
});

describe("converting money to periods", () => {
  it("counts whole periods only", () => {
    expect(periodsCovered(350, 100)).toBe(3);
    expect(periodsCovered(90, 100)).toBe(0);
    expect(periodsCovered(100, 0)).toBe(0);
  });
});
