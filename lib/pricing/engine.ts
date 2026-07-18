// Rule-based pricing engine v1 — pure and unit-testable, no I/O.
//
//   suggestedRate = baseNightlyRate × seasonalityFactor × demandFactor
//   … nudged 25% toward the district benchmark ADR when one exists,
//   clamped to [0.6×base, 1.8×base], rounded to whole currency units.
//
// If the benchmark ADR sits well above the suggestion, the unit is flagged
// underpriced (feeds the `underpriced` alert).

import { seasonalityFactor } from "./seasonality";

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
  benchmarkAdr: number | null;
  floor: number;
  ceiling: number;
};

export interface PricingResult {
  suggestedRate: number;
  factors: PricingFactors;
  underpriced: boolean;
  /** Machine-readable reason codes, e.g. "high_season", "low_occupancy". */
  reasons: string[];
}

const BENCHMARK_NUDGE = 0.25; // pull 25% of the way toward benchmark ADR
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
  const month = input.date.getUTCMonth() + 1;
  const seasonality = seasonalityFactor(input.city, month);
  const demand = demandFactor(input.upcomingOccupancy);

  const floor = input.baseNightlyRate * FLOOR_RATIO;
  const ceiling = input.baseNightlyRate * CEILING_RATIO;

  let rate = input.baseNightlyRate * seasonality * demand;

  const benchmarkAdr = input.benchmarkAdr ?? null;
  if (benchmarkAdr != null && benchmarkAdr > 0) {
    rate += (benchmarkAdr - rate) * BENCHMARK_NUDGE;
  }

  rate = Math.min(ceiling, Math.max(floor, rate));
  const suggestedRate = Math.round(rate);

  const reasons: string[] = [];
  if (seasonality > 1.05) reasons.push("high_season");
  else if (seasonality < 0.95) reasons.push("low_season");
  if (input.upcomingOccupancy >= 0.7) reasons.push("high_occupancy");
  else if (input.upcomingOccupancy < 0.3) reasons.push("low_occupancy");
  if (benchmarkAdr != null) {
    if (benchmarkAdr > suggestedRate) reasons.push("below_benchmark");
    else if (benchmarkAdr < suggestedRate) reasons.push("above_benchmark");
  }

  return {
    suggestedRate,
    factors: { seasonality, demand, benchmarkAdr, floor, ceiling },
    underpriced:
      benchmarkAdr != null && benchmarkAdr > suggestedRate * UNDERPRICED_RATIO,
    reasons,
  };
}
