// Pluggable market-data abstraction. Real figures come from
// lib/market/figures.ts (published reports, aggregated listing exports and
// the anonymous averages of customers' own data); the seeded
// MarketBenchmark estimates fill in where there is nothing yet. Listings
// are never republished — only district aggregates are kept.

import { asCurrency, fromGel } from "@/lib/fx/convert";
import { loadGelRates } from "@/lib/fx/gel-rates";
import { seededMarketBenchmark } from "./seeded";
import { prisma } from "@/lib/db";
import { districtKey } from "@/lib/places";
import { marketFigure } from "./figures";

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

// Market figures (lib/market/figures.ts: reports, listings, Activo's own
// data) where there are any, else the built-in MarketBenchmark estimate.
export class DbMarketDataSource implements MarketDataSource {
  async getBenchmark(
    district: string,
    month: string,
  ): Promise<BenchmarkRow | null> {
    // Benchmarks are keyed by the canonical district ("Vake"), whatever
    // language the owner typed it in ("ვაკე").
    const key = districtKey(district) ?? district;
    const [adr, occupancy, row] = await Promise.all([
      marketFigure(key, "adr", month),
      marketFigure(key, "occupancy", month),
      seededMarketBenchmark(key, month),
    ]);
    const realAdr = adr && !adr.estimate ? adr : null;
    const realOcc = occupancy && !occupancy.estimate ? occupancy : null;
    if (!realAdr && !realOcc) {
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
    const adrValue = realAdr?.value ?? row?.adr;
    const occValue = realOcc?.value ?? row?.occupancyRate;
    if (adrValue == null || occValue == null) return null;
    return {
      district: key,
      month,
      adr: adrValue,
      occupancyRate: occValue,
      sampleSize: [...(realAdr?.parts ?? []), ...(realOcc?.parts ?? [])].reduce((max, part) => Math.max(max, part.sampleSize), 0),
      source: "market",
    };
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
      this.rows.find((r) => r.district === (districtKey(district) ?? district) && r.month === month) ??
      null
    );
  }
}

export function getMarketDataSource(): MarketDataSource {
  return new DbMarketDataSource();
}

/**
 * A district's average nightly price, in the currency the unit is priced
 * in: market figures are in lari, a unit may be priced in dollars.
 */
export async function benchmarkAdrIn(
  market: MarketDataSource,
  district: string | null | undefined,
  month: string,
  currency: string | null | undefined,
): Promise<number | null> {
  if (!district) return null;
  const adr = (await market.getBenchmark(district, month))?.adr ?? null;
  if (adr == null || asCurrency(currency) === "GEL") return adr;
  return fromGel(adr, currency, await loadGelRates());
}
