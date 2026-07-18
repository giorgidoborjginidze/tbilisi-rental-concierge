// Pluggable market-data abstraction. The MVP ships with mock data (seeded
// into the MarketBenchmark table and a static in-memory source for tests);
// a real, compliant source (partnership or lawful aggregation) can be
// plugged in later without touching consumers. No scraping/republishing of
// third-party listings.

import { prisma } from "@/lib/db";

export interface BenchmarkRow {
  district: string;
  month: string; // "YYYY-MM"
  adr: number;
  occupancyRate: number;
  sampleSize: number;
  source: string;
}

export interface MarketDataSource {
  getBenchmark(district: string, month: string): Promise<BenchmarkRow | null>;
}

// Reads the (mock-seeded) MarketBenchmark table.
export class DbMarketDataSource implements MarketDataSource {
  async getBenchmark(
    district: string,
    month: string,
  ): Promise<BenchmarkRow | null> {
    const row = await prisma.marketBenchmark.findUnique({
      where: { district_month: { district, month } },
    });
    return row
      ? {
          district: row.district,
          month: row.month,
          adr: row.adr,
          occupancyRate: row.occupancyRate,
          sampleSize: row.sampleSize,
          source: row.source,
        }
      : null;
  }
}

// Static in-memory source for tests and offline use.
export class MockMarketDataSource implements MarketDataSource {
  constructor(private rows: BenchmarkRow[]) {}

  async getBenchmark(
    district: string,
    month: string,
  ): Promise<BenchmarkRow | null> {
    return (
      this.rows.find((r) => r.district === district && r.month === month) ??
      null
    );
  }
}

export function getMarketDataSource(): MarketDataSource {
  return new DbMarketDataSource();
}
