// Rule-based pricing engine v1 — pure and unit-testable, no I/O.
//
//   suggestedRate = baseNightlyRate × seasonality × demand × weekend
//   (seasonality blends across month boundaries; Friday and Saturday
//   nights carry the weekend factor)
//   … nudged 25% toward the district benchmark ADR when one exists,
//   clamped to [0.6×base, 1.8×base], rounded to whole currency units.
//
// If the benchmark ADR sits well above the suggestion, the unit is flagged
// underpriced (feeds the `underpriced` alert).

import { seasonalityOn } from "./seasonality";
import { cityKey } from "@/lib/places";

export interface PricingInput {
  baseNightlyRate: number;
  city: string;
  date: Date;
  /** The unit's own occupancy over the next 30 days, 0..1. */
  upcomingOccupancy: number;
  /** District benchmark ADR for the date's month, if known. */
  benchmarkAdr?: number | null;
}

// Type alias (not interface) so it satisfies Prisma's Json input type.
export type PricingFactors = {
  seasonality: number;
  demand: number;
  weekend: number;
  benchmarkAdr: number | null;
  floor: number;
  ceiling: number;
};

export interface PricingResult {
  suggestedRate: number;
  factors: PricingFactors;
  underpriced: boolean;
  /**
   * Machine-readable reason codes, one per force that moved the price and
   * in the direction it moved it: "high_season" / "low_season" (the
   * seasonality factor), "high_occupancy" / "low_occupancy" (the demand
   * factor), "below_benchmark" (the district average pulled it UP) /
   * "above_benchmark" (pulled it DOWN), "at_floor" / "at_ceiling".
   */
  reasons: string[];
  /** The arithmetic, step by step, for the page to show. */
  steps: RateSteps;
}

/** How a suggestion was reached — every figure the page prints. */
export interface RateSteps {
  base: number;
  seasonality: number;
  demand: number;
  /** Friday and Saturday nights (1 on other nights). */
  weekend: number;
  /** base × seasonality × demand × weekend. */
  raw: number;
  /** After the pull toward the district average (null without one). */
  nudged: number | null;
  /** The pull as a share of the gap (0.25). */
  nudgeShare: number;
  /** The floor or ceiling that capped it, if any. */
  capped: "floor" | "ceiling" | null;
  final: number;
}

const BENCHMARK_NUDGE = 0.25; // pull 25% of the way toward benchmark ADR
/** Friday and Saturday nights sell for more in Georgian city and resort markets. */
export const WEEKEND_FACTOR = 1.1;

/** The weekend factor of a night (Friday and Saturday). */
export const weekendFactor = (date: Date): number => {
  const day = date.getUTCDay();
  return day === 5 || day === 6 ? WEEKEND_FACTOR : 1;
};
const FLOOR_RATIO = 0.6;
const CEILING_RATIO = 1.8;
const UNDERPRICED_RATIO = 1.25; // benchmark 25%+ above suggestion → underpriced

export function demandFactor(upcomingOccupancy: number): number {
  if (upcomingOccupancy >= 0.85) return 1.15;
  if (upcomingOccupancy >= 0.7) return 1.08;
  if (upcomingOccupancy >= 0.5) return 1.0;
  if (upcomingOccupancy >= 0.3) return 0.93;
  return 0.85;
}

export function suggestRate(input: PricingInput): PricingResult {
  // Seasonality is keyed by the canonical city ("ბათუმი" → "Batumi"),
  // blended across month boundaries.
  const seasonality = seasonalityOn(cityKey(input.city) ?? input.city, input.date);
  const demand = demandFactor(input.upcomingOccupancy);
  const weekend = weekendFactor(input.date);

  const floor = input.baseNightlyRate * FLOOR_RATIO;
  const ceiling = input.baseNightlyRate * CEILING_RATIO;

  const raw = input.baseNightlyRate * seasonality * demand * weekend;
  let rate = raw;

  const benchmarkAdr = input.benchmarkAdr ?? null;
  const pulls = benchmarkAdr != null && benchmarkAdr > 0;
  if (pulls) rate += (benchmarkAdr - rate) * BENCHMARK_NUDGE;
  const nudged = pulls ? rate : null;

  const capped = rate < floor ? "floor" : rate > ceiling ? "ceiling" : null;
  rate = Math.min(ceiling, Math.max(floor, rate));
  const suggestedRate = Math.round(rate);

  // One reason per force that actually moved the price, named in the
  // direction it moved it — so "lowered for low season" never sits next to
  // an unexplained factor, and the district average is said to pull the
  // price up or down, not merely to be "above" or "below".
  const reasons: string[] = [];
  if (seasonality > 1) reasons.push("high_season");
  else if (seasonality < 1) reasons.push("low_season");
  if (demand > 1) reasons.push("high_occupancy");
  else if (demand < 1) reasons.push("low_occupancy");
  if (weekend > 1) reasons.push("weekend");
  if (pulls && capped == null) {
    if (benchmarkAdr > raw) reasons.push("below_benchmark");
    else if (benchmarkAdr < raw) reasons.push("above_benchmark");
  }
  if (capped === "floor") reasons.push("at_floor");
  if (capped === "ceiling") reasons.push("at_ceiling");

  return {
    suggestedRate,
    factors: { seasonality, demand, weekend, benchmarkAdr, floor, ceiling },
    underpriced:
      benchmarkAdr != null && benchmarkAdr > suggestedRate * UNDERPRICED_RATIO,
    reasons,
    steps: {
      base: input.baseNightlyRate,
      seasonality,
      demand,
      weekend,
      raw,
      nudged,
      nudgeShare: BENCHMARK_NUDGE,
      capped,
      final: suggestedRate,
    },
  };
}

/**
 * Consecutive nights with the same price and the same reasons, as one
 * run ("1–13 Oct: 122") — a fortnight of identical rows says nothing the
 * first one did not.
 */
export function groupRuns<T extends { result: PricingResult; rationale: string }>(
  rows: T[],
): { first: T; last: T; nights: number }[] {
  const runs: { first: T; last: T; nights: number }[] = [];
  for (const row of rows) {
    const current = runs[runs.length - 1];
    if (
      current &&
      current.last.result.suggestedRate === row.result.suggestedRate &&
      current.last.rationale === row.rationale &&
      current.last.result.underpriced === row.result.underpriced &&
      current.last.result.factors.benchmarkAdr === row.result.factors.benchmarkAdr
    ) {
      current.last = row;
      current.nights += 1;
    } else {
      runs.push({ first: row, last: row, nights: 1 });
    }
  }
  return runs;
}
