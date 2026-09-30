import { describe, expect, it } from "vitest";
import { demandFactor, groupRuns, suggestRate } from "./engine";
import { seasonalityFactor } from "./seasonality";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("seasonalityFactor", () => {
  it("peaks in summer, dips in winter, Batumi more extreme", () => {
    expect(seasonalityFactor("Tbilisi", 8)).toBeGreaterThan(
      seasonalityFactor("Tbilisi", 2),
    );
    expect(seasonalityFactor("Batumi", 8)).toBeGreaterThan(
      seasonalityFactor("Tbilisi", 8),
    );
    expect(seasonalityFactor("Batumi", 1)).toBeLessThan(
      seasonalityFactor("Tbilisi", 1),
    );
  });

  it("defaults to 1.0 for unknown months", () => {
    expect(seasonalityFactor("Tbilisi", 13)).toBe(1.0);
  });
});

describe("demandFactor", () => {
  it("raises the rate when the unit is nearly full and lowers it when empty", () => {
    expect(demandFactor(0.9)).toBeGreaterThan(1);
    expect(demandFactor(0.5)).toBe(1.0);
    expect(demandFactor(0.1)).toBeLessThan(1);
  });
});

describe("suggestRate", () => {
  it("multiplies base rate by seasonality and demand", () => {
    const result = suggestRate({
      baseNightlyRate: 100,
      city: "Tbilisi",
      date: d("2026-04-15"), // seasonality 1.0
      upcomingOccupancy: 0.5, // demand 1.0
      benchmarkAdr: null,
    });
    expect(result.suggestedRate).toBe(100);
    expect(result.underpriced).toBe(false);
  });

  it("raises the rate in high season with high occupancy", () => {
    const result = suggestRate({
      baseNightlyRate: 100,
      city: "Batumi",
      date: d("2026-08-01"), // 1.65
      upcomingOccupancy: 0.9, // 1.15
      benchmarkAdr: null,
    });
    // 100 × 1.65 × 1.15 = 189.75 → clamped to ceiling 180
    expect(result.suggestedRate).toBe(180);
    expect(result.reasons).toContain("high_season");
    expect(result.reasons).toContain("high_occupancy");
  });

  it("clamps to the floor in dead season with no demand", () => {
    const result = suggestRate({
      baseNightlyRate: 100,
      city: "Batumi",
      date: d("2026-01-15"), // 0.6
      upcomingOccupancy: 0.1, // 0.85 → 51, floor is 60
      benchmarkAdr: null,
    });
    expect(result.suggestedRate).toBe(60);
    expect(result.reasons).toContain("low_season");
  });

  it("nudges 25% toward the benchmark ADR", () => {
    const result = suggestRate({
      baseNightlyRate: 100,
      city: "Tbilisi",
      date: d("2026-04-15"),
      upcomingOccupancy: 0.5, // raw = 100
      benchmarkAdr: 140,
    });
    // 100 + (140 - 100) × 0.25 = 110
    expect(result.suggestedRate).toBe(110);
    expect(result.reasons).toContain("below_benchmark");
  });

  it("flags underpriced when benchmark is far above the suggestion", () => {
    const result = suggestRate({
      baseNightlyRate: 100,
      city: "Tbilisi",
      date: d("2026-04-15"),
      upcomingOccupancy: 0.5,
      benchmarkAdr: 200, // suggestion ≈ 125; 200 > 125 × 1.25
    });
    expect(result.underpriced).toBe(true);
  });

  it("does not flag underpriced when benchmark is close", () => {
    const result = suggestRate({
      baseNightlyRate: 100,
      city: "Tbilisi",
      date: d("2026-04-15"),
      upcomingOccupancy: 0.5,
      benchmarkAdr: 115,
    });
    expect(result.underpriced).toBe(false);
  });
});

describe("suggestRate explains itself", () => {
  // persona-hotel-10: Batumi in October, base 130, district average 135.
  const october = suggestRate({
    baseNightlyRate: 130,
    city: "Batumi",
    date: d("2026-10-05"), // 0.9
    upcomingOccupancy: 0.6, // 1.0
    benchmarkAdr: 135,
  });

  it("shows the arithmetic that reaches the price", () => {
    expect(october.steps.raw).toBeCloseTo(117, 6);
    expect(october.steps.nudged).toBeCloseTo(117 + (135 - 117) * 0.25, 6);
    expect(october.steps.capped).toBeNull();
    expect(october.steps.final).toBe(122);
    expect(october.suggestedRate).toBe(122);
  });

  it("names each force in the direction it moved the price", () => {
    // Lowered by the season, pulled UP by the district average — not
    // "lowered … still below the average".
    expect(october.reasons).toEqual(["low_season", "below_benchmark"]);
  });

  it("explains every factor that is not 1, including mild demand", () => {
    const r = suggestRate({
      baseNightlyRate: 100,
      city: "Tbilisi",
      date: d("2026-04-15"), // 1.0
      upcomingOccupancy: 0.4, // 0.93 — used to move the price with no reason given
      benchmarkAdr: null,
    });
    expect(r.suggestedRate).toBe(93);
    expect(r.reasons).toEqual(["low_occupancy"]);
  });

  it("says when the floor or ceiling decided the price", () => {
    const floor = suggestRate({
      baseNightlyRate: 100,
      city: "Batumi",
      date: d("2026-01-15"),
      upcomingOccupancy: 0.1,
      benchmarkAdr: null,
    });
    expect(floor.steps.capped).toBe("floor");
    expect(floor.reasons).toContain("at_floor");
  });
});

describe("groupRuns", () => {
  const row = (date: string, rate: number, rationale = "r") => ({
    date: d(date),
    rationale,
    result: suggestRate({
      baseNightlyRate: rate,
      city: "Tbilisi",
      date: d("2026-04-15"),
      upcomingOccupancy: 0.5,
      benchmarkAdr: null,
    }),
  });

  it("folds consecutive nights with the same price and reason", () => {
    const runs = groupRuns([
      row("2026-10-01", 120),
      row("2026-10-02", 120),
      row("2026-10-03", 120),
      row("2026-10-04", 130),
      row("2026-10-05", 120),
    ]);
    expect(runs.map((run) => run.nights)).toEqual([3, 1, 1]);
    expect(runs[0].last.date).toEqual(d("2026-10-03"));
  });

  it("keeps nights apart when the reason differs", () => {
    expect(groupRuns([row("2026-10-01", 120, "a"), row("2026-10-02", 120, "b")])).toHaveLength(2);
  });
});
