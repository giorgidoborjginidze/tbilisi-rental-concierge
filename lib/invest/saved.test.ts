import { describe, expect, it } from "vitest";
import { cleanScenario, summarize } from "./saved";
import { WORTHINESS_DEFAULTS_GEL } from "./worthiness";

describe("kept PRO scenarios", () => {
  it("keeps only known figures and fills the rest", () => {
    const clean = cleanScenario({ inputs: { price: "250000", evil: "x", vacancyPct: "abc", taxModel: "profit" }, currency: "USD" });
    expect(clean.inputs.price).toBe(250000);
    expect(clean.inputs.vacancyPct).toBe(WORTHINESS_DEFAULTS_GEL.vacancyPct);
    expect(clean.inputs.taxModel).toBe("profit");
    expect("evil" in clean.inputs).toBe(false);
    expect(clean.currency).toBe("USD");
    expect(cleanScenario(null).currency).toBe("GEL");
  });

  it("summarises from the figures, not from anything stored", () => {
    const better = summarize(cleanScenario({ inputs: { ...WORTHINESS_DEFAULTS_GEL, monthlyRent: 2500 } }));
    const worse = summarize(cleanScenario({ inputs: { ...WORTHINESS_DEFAULTS_GEL, monthlyRent: 900 } }));
    expect(better.cashFlowMonth).toBeGreaterThan(worse.cashFlowMonth);
    expect(["good", "ok", "poor"]).toContain(better.verdict);
  });
});
