import { describe, expect, it } from "vitest";
import { planContractRepair, type LegacyContract } from "./repair";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const repairDay = d("2026-09-30");
const now = new Date("2026-09-30T12:00:00Z");

const legacy = (over: Partial<LegacyContract>): LegacyContract => ({
  startDate: d("2026-03-01"),
  endDate: d("2027-02-28"),
  paymentPeriod: "monthly",
  paymentAmount: null,
  monthlyRent: 1200,
  paidThrough: d("2026-03-01"),
  creditBalance: 0,
  openingAt: null,
  paymentCount: 0,
  asset: { rentalMode: "long_term" },
  ...over,
});

describe("planContractRepair", () => {
  it("clears the false 213-day debt of a running lease typed in with nothing paid", () => {
    const plan = planContractRepair(legacy({}), repairDay, now)!;
    expect(plan.untracked).toBe(true);
    expect(plan.paidThrough).toBeNull();
    expect(plan.paymentAmount).toBe(1200);
    expect(plan.monthlyRent).toBe(1200);
    expect(plan.status).toBe("active");
    expect(plan.openingAt).toEqual(now);
  });

  it("turns a daily contract's per-day 'monthly rent' into a day price", () => {
    const plan = planContractRepair(
      legacy({
        paymentPeriod: "daily",
        monthlyRent: 60,
        startDate: d("2026-09-20"),
        endDate: d("2027-09-20"),
        paidThrough: d("2026-09-22"),
        paymentCount: 1,
      }),
      repairDay,
      now,
    )!;
    expect(plan.paymentAmount).toBe(60);
    expect(plan.monthlyRent).toBe(1826.4);
    // Money was recorded: the position stands.
    expect(plan.untracked).toBe(false);
    expect(plan.paidThrough).toEqual(d("2026-09-22"));
    expect(plan.openingPaidThrough).toEqual(d("2026-09-22"));
  });

  it("keeps a per-period amount that was already set, and normalises the month", () => {
    const plan = planContractRepair(
      legacy({ paymentPeriod: "weekly", paymentAmount: 350, monthlyRent: 1400, paymentCount: 2, paidThrough: d("2026-09-25") }),
      repairDay,
      now,
    )!;
    expect(plan.paymentAmount).toBe(350);
    expect(plan.monthlyRent).toBe(1520.75);
    // Weekly due dates run on the start's weekday (1 Mar, a Sunday): an
    // off-grid 25 Sep moves up to Sunday 27 Sep, never down into a debt.
    expect(plan.paidThrough).toEqual(d("2026-09-27"));
  });

  it("reads a short 'monthly' calendar stay on a daily-let asset as nightly", () => {
    const plan = planContractRepair(
      legacy({
        startDate: d("2026-09-30"),
        endDate: d("2026-10-01"),
        monthlyRent: 180,
        paidThrough: d("2026-09-30"),
        asset: { rentalMode: "daily" },
      }),
      repairDay,
      now,
    )!;
    expect(plan.paymentPeriod).toBe("daily");
    expect(plan.paymentAmount).toBe(180);
    // It starts today, so "nothing paid yet" is still true: kept tracked.
    expect(plan.untracked).toBe(false);
    expect(plan.paidThrough).toEqual(d("2026-09-30"));
  });

  it("moves a drifted monthly date back onto the start day", () => {
    const plan = planContractRepair(
      legacy({
        startDate: d("2026-01-31"),
        endDate: d("2027-01-31"),
        paidThrough: d("2026-03-28"),
        paymentCount: 2,
      }),
      repairDay,
      now,
    )!;
    expect(plan.paidThrough).toEqual(d("2026-03-31"));
  });

  it("marks a finished contract as ended", () => {
    const plan = planContractRepair(
      legacy({ startDate: d("2025-09-01"), endDate: d("2026-08-10"), paidThrough: null }),
      repairDay,
      now,
    )!;
    expect(plan.status).toBe("ended");
    expect(plan.untracked).toBe(false);
  });

  it("is idempotent: a contract whose ledger is open is left alone", () => {
    expect(planContractRepair(legacy({ openingAt: now }), repairDay, now)).toBeNull();
  });
});

describe("dueDateOfDedupeKey", () => {
  it("reads the due date out of a payment reminder's key", async () => {
    const { dueDateOfDedupeKey } = await import("./settle");
    expect(dueDateOfDedupeKey("pay|c1|2026-09-20|repossess")).toBe("2026-09-20");
    expect(dueDateOfDedupeKey("pay|c1|2026-09-20|late3")).toBe("2026-09-20");
    expect(dueDateOfDedupeKey("geo|e1|driver")).toBeNull();
  });
});
