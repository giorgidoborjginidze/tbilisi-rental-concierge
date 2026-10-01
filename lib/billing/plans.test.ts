import { describe, expect, it } from "vitest";
import {
  addMonthsUtc,
  effectivePlan,
  fallbackPlan,
  GRACE_DAYS,
  paidUntilAfterPayment,
  planStanding,
  renewedUntil,
  planById,
  plansFor,
  trialDaysLeft,
  trialPlan,
  underLimit,
} from "./plans";

const now = new Date("2026-07-19T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

describe("plan catalog", () => {
  it("has three personal and two business tiers", () => {
    expect(plansFor("personal").map((p) => p.id)).toEqual(["starter", "standard", "pro"]);
    expect(plansFor("business").map((p) => p.id)).toEqual(["biz_s", "biz_m"]);
  });

  it("personal asset limits are 5 / 20 / 50", () => {
    expect(plansFor("personal").map((p) => p.maxAssets)).toEqual([5, 20, 50]);
  });

  it("trial grants the top tier; the fallback is a free allowance below the cheapest plan", () => {
    expect(trialPlan("personal").id).toBe("pro");
    expect(trialPlan("business").id).toBe("biz_m");
    expect(fallbackPlan("personal").id).toBe("free");
    expect(fallbackPlan("business").id).toBe("free");
    // A paid plan always buys more than not paying.
    expect(fallbackPlan("personal").maxAssets).toBeLessThan(plansFor("personal")[0].maxAssets);
    expect(fallbackPlan("personal").maxUnits).toBeLessThan(plansFor("personal")[0].maxUnits);
    expect(fallbackPlan("business").maxAssets).toBeLessThan(plansFor("business")[0].maxAssets);
  });
});

describe("trialDaysLeft", () => {
  it("counts remaining days, rounding up", () => {
    expect(trialDaysLeft(inDays(30), now)).toBe(30);
    expect(trialDaysLeft(new Date(now.getTime() + 3_600_000), now)).toBe(1);
  });

  it("is 0 when expired or unset", () => {
    expect(trialDaysLeft(inDays(-1), now)).toBe(0);
    expect(trialDaysLeft(null, now)).toBe(0);
  });
});

describe("effectivePlan", () => {
  it("uses the chosen plan while it is paid", () => {
    const plan = effectivePlan(
      { accountType: "personal", plan: "standard", trialEndsAt: inDays(-5), paidUntil: inDays(12) },
      now,
    );
    expect(plan.id).toBe("standard");
  });

  it("keeps the plan for the grace days after the paid-through date, then falls back", () => {
    const state = (paidUntil: Date) =>
      ({ accountType: "personal", plan: "standard", trialEndsAt: inDays(-60), paidUntil }) as const;
    expect(effectivePlan(state(inDays(-1)), now).id).toBe("standard");
    expect(planStanding(state(inDays(-1)), now)).toBe("grace");
    expect(effectivePlan(state(inDays(-GRACE_DAYS - 0.01)), now).id).toBe("free");
    expect(planStanding(state(inDays(-GRACE_DAYS - 0.01)), now)).toBe("expired");
  });

  it("does not let one payment unlock a plan forever", () => {
    // Paid once, seven months ago: back to the free bottom tier, no analysis.
    const plan = effectivePlan(
      { accountType: "personal", plan: "standard", trialEndsAt: inDays(-240), paidUntil: inDays(-210) },
      now,
    );
    expect(plan.id).toBe("free");
    expect(plan.analysis).toBe(false);
  });

  it("treats a plan with no payment at all as unpaid (trial or bottom tier)", () => {
    const base = { accountType: "personal", plan: "pro", paidUntil: null } as const;
    expect(effectivePlan({ ...base, trialEndsAt: inDays(5) }, now).id).toBe("pro"); // the trial
    expect(effectivePlan({ ...base, trialEndsAt: inDays(-5) }, now).id).toBe("free");
    expect(planStanding({ ...base, trialEndsAt: inDays(-5) }, now)).toBe("expired");
  });

  it("keeps the demo's showcase plan without payment", () => {
    const plan = effectivePlan(
      { accountType: "personal", plan: "pro", trialEndsAt: inDays(-200), paidUntil: null, complimentary: true },
      now,
    );
    expect(plan.id).toBe("pro");
  });

  it("ignores a plan of the wrong account type", () => {
    const plan = effectivePlan(
      { accountType: "business", plan: "pro", trialEndsAt: inDays(10), paidUntil: inDays(20) },
      now,
    );
    expect(plan.id).toBe("biz_m"); // trial tier, not the personal plan
  });

  it("grants the top tier during the trial", () => {
    const plan = effectivePlan(
      { accountType: "personal", plan: null, trialEndsAt: inDays(10), paidUntil: null },
      now,
    );
    expect(plan.id).toBe("pro");
  });

  it("falls back to the free allowance after the trial", () => {
    const plan = effectivePlan(
      { accountType: "personal", plan: null, trialEndsAt: inDays(-1), paidUntil: null },
      now,
    );
    expect(plan.id).toBe("free");
  });
});

describe("underLimit", () => {
  it("permits up to, but not past, the maximum", () => {
    expect(underLimit(4, 5)).toBe(true);
    expect(underLimit(5, 5)).toBe(false);
  });
});

describe("planById", () => {
  it("resolves known ids and rejects unknown ones", () => {
    expect(planById("pro")?.priceGel).toBe(49);
    expect(planById("nope")).toBeNull();
    expect(planById(null)).toBeNull();
  });
});

describe("renewal", () => {
  it("adds calendar months in UTC, clamped to the month's last day", () => {
    expect(addMonthsUtc(new Date("2026-01-31T10:30:00Z"), 1).toISOString()).toBe("2026-02-28T10:30:00.000Z");
    expect(addMonthsUtc(new Date("2028-01-31T10:30:00Z"), 1).toISOString()).toBe("2028-02-29T10:30:00.000Z");
    expect(addMonthsUtc(new Date("2026-12-15T00:00:00Z"), 1).toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("extends from the current paid-through date when renewing early — no days lost", () => {
    const paidUntil = inDays(10);
    expect(renewedUntil(paidUntil, now).toISOString()).toBe(addMonthsUtc(paidUntil, 1).toISOString());
  });

  it("extends from now when the plan has lapsed or was never paid", () => {
    expect(renewedUntil(inDays(-2), now).toISOString()).toBe(addMonthsUtc(now, 1).toISOString());
    expect(renewedUntil(null, now).toISOString()).toBe(addMonthsUtc(now, 1).toISOString());
  });
});

describe("paidUntilAfterPayment (plan changes)", () => {
  const iso = (d: Date) => d.toISOString();

  it("renews the same plan after the current paid-through date", () => {
    const paidUntil = inDays(40);
    expect(iso(paidUntilAfterPayment({ plan: "pro", paidUntil }, "pro", now))).toBe(iso(addMonthsUtc(paidUntil, 1)));
  });

  it("upgrade: converts the unused cheaper time at the two prices, then adds the month", () => {
    // 330 days of Starter left (15 GEL) → 330 × 15 / 49 ≈ 101 days of Pro.
    const result = paidUntilAfterPayment({ plan: "starter", paidUntil: inDays(330) }, "pro", now);
    const credit = (330 * 86_400_000 * 15) / 49;
    expect(iso(result)).toBe(iso(addMonthsUtc(new Date(now.getTime() + Math.floor(credit)), 1)));
    // Far less than the 11 prepaid months carried over one to one.
    expect(result < addMonthsUtc(inDays(330), 1)).toBe(true);
    expect(result < inDays(140)).toBe(true);
  });

  it("downgrade: the unused dearer time buys more of the cheaper plan, never less", () => {
    // 30 days of Pro (49) → 98 days of Starter (15), then the paid month.
    const result = paidUntilAfterPayment({ plan: "pro", paidUntil: inDays(30) }, "starter", now);
    const credit = Math.floor((30 * 86_400_000 * 49) / 15);
    expect(iso(result)).toBe(iso(addMonthsUtc(new Date(now.getTime() + credit), 1)));
    expect(result > addMonthsUtc(inDays(30), 1)).toBe(true);
  });

  it("counts from now when nothing is paid ahead (lapsed, grace, never paid)", () => {
    expect(iso(paidUntilAfterPayment({ plan: "starter", paidUntil: inDays(-1) }, "pro", now))).toBe(iso(addMonthsUtc(now, 1)));
    expect(iso(paidUntilAfterPayment({ plan: "pro", paidUntil: inDays(-1) }, "pro", now))).toBe(iso(addMonthsUtc(now, 1)));
    expect(iso(paidUntilAfterPayment({ plan: null, paidUntil: null }, "standard", now))).toBe(iso(addMonthsUtc(now, 1)));
  });

  it("gives no credit for an unknown old plan", () => {
    expect(iso(paidUntilAfterPayment({ plan: "legacy", paidUntil: inDays(90) }, "pro", now))).toBe(iso(addMonthsUtc(now, 1)));
  });
});

describe("paying during the free trial", () => {
  it("keeps the trial's top tier until the trial ends, then the plan bought", () => {
    const state = { accountType: "personal", plan: "standard", trialEndsAt: inDays(20), paidUntil: inDays(50) } as const;
    expect(effectivePlan(state, now).id).toBe("pro");
    expect(effectivePlan(state, inDays(25)).id).toBe("standard");
  });

  it("counts the paid month from the trial's end, not from today", () => {
    const trialEndsAt = inDays(20);
    const until = paidUntilAfterPayment({ plan: null, paidUntil: null, trialEndsAt }, "standard", now);
    expect(until.getTime()).toBe(addMonthsUtc(trialEndsAt, 1).getTime());
  });
});
