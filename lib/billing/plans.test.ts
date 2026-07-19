import { describe, expect, it } from "vitest";
import {
  effectivePlan,
  fallbackPlan,
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

  it("trial grants the top tier, fallback is the bottom tier", () => {
    expect(trialPlan("personal").id).toBe("pro");
    expect(trialPlan("business").id).toBe("biz_m");
    expect(fallbackPlan("personal").id).toBe("starter");
    expect(fallbackPlan("business").id).toBe("biz_s");
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
  it("uses the chosen plan when set", () => {
    const plan = effectivePlan(
      { accountType: "personal", plan: "standard", trialEndsAt: inDays(-5) },
      now,
    );
    expect(plan.id).toBe("standard");
  });

  it("ignores a plan of the wrong account type", () => {
    const plan = effectivePlan(
      { accountType: "business", plan: "pro", trialEndsAt: inDays(10) },
      now,
    );
    expect(plan.id).toBe("biz_m"); // trial tier, not the personal plan
  });

  it("grants the top tier during the trial", () => {
    const plan = effectivePlan(
      { accountType: "personal", plan: null, trialEndsAt: inDays(10) },
      now,
    );
    expect(plan.id).toBe("pro");
  });

  it("falls back to the bottom tier after the trial", () => {
    const plan = effectivePlan(
      { accountType: "personal", plan: null, trialEndsAt: inDays(-1) },
      now,
    );
    expect(plan.id).toBe("starter");
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
