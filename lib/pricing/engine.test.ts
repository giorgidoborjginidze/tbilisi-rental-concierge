import { describe, expect, it } from "vitest";
import { demandFactor, suggestRate } from "./engine";
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
