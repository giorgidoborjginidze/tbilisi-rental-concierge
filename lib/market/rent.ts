// Long-term rent benchmark access (estimated averages seeded into the
// RentBenchmark table).
// Same pluggable stance as MarketDataSource: swap for a real, compliant
// source later without touching consumers.

import { prisma } from "@/lib/db";
import { districtKey } from "@/lib/places";
import { marketFigure } from "./figures";

export interface RentBenchmarkRow {
  district: string;
  month: string;
  avgRentPerSqm: number;
  sampleSize: number;
  source: string;
}

export async function getRentBenchmark(
  district: string,
  month: string,
): Promise<RentBenchmarkRow | null> {
  // Keyed by the canonical district: "ვაკე" finds "Vake".
  const key = districtKey(district) ?? district;
  // Real figures first (reports, listings, Activo's own data).
  const real = await marketFigure(key, "rent_sqm", month);
  if (real && !real.estimate) {
    return {
      district: key,
      month,
      avgRentPerSqm: real.value,
      sampleSize: real.parts.reduce((sum, part) => sum + part.sampleSize, 0),
      source: "market",
    };
  }
  const row = await prisma.rentBenchmark.findUnique({
    where: { district_month: { district: key, month } },
  });
  return row
    ? {
        district: row.district,
        month: row.month,
        avgRentPerSqm: row.avgRentPerSqm,
        sampleSize: row.sampleSize,
        source: row.source,
      }
    : null;
}

// Market-rent estimate for a real-estate asset: area × district GEL/m².
export function estimateMarketRent(
  areaSqm: number | null,
  benchmark: RentBenchmarkRow | null,
): number | null {
  if (!areaSqm || !benchmark) return null;
  return Math.round(areaSqm * benchmark.avgRentPerSqm);
}
