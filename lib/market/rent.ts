// Long-term rent benchmark access (mock-seeded RentBenchmark table).
// Same pluggable stance as MarketDataSource: swap for a real, compliant
// source later without touching consumers.

import { prisma } from "@/lib/db";

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
  const row = await prisma.rentBenchmark.findUnique({
    where: { district_month: { district, month } },
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
