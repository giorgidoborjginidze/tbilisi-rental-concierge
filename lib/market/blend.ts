// Turning the market figures we hold into one number per district and
// metric, and saying where it came from. Pure.
//
// Each source keeps its newest figure while it is fresh enough for what it
// is — a quarterly report stays useful longer than a month of listings.
// The fresh ones are averaged with weights: a published report counts
// fully; listings and Activo's own data count by how many they rest on
// (a figure from four contracts is a hint, from forty a fact). Without any
// fresh figure the caller falls back to the built-in estimate and says so.

export const MARKET_METRICS = ["rent_sqm", "sale_sqm", "adr", "occupancy"] as const;
export type MarketMetric = (typeof MARKET_METRICS)[number];

export const MARKET_SOURCES = ["report", "listings", "activo"] as const;
export type MarketSource = (typeof MARKET_SOURCES)[number];

export interface FigureRow {
  source: string;
  sourceName: string;
  period: string; // "YYYY-MM"
  value: number;
  sampleSize: number;
}

/** How many months a figure from each source stays usable. */
export const FRESH_MONTHS: Record<MarketSource, number> = { report: 9, listings: 3, activo: 3 };

/** The sample at which a counted source weighs as much as a report. */
const FULL_SAMPLE: Record<MarketSource, number> = { report: 1, listings: 30, activo: 15 };

const monthIndex = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return y * 12 + (m - 1);
};

export interface BlendPart extends FigureRow {
  weight: number;
}

export interface Blended {
  value: number;
  /** The figures it rests on, the heaviest first. */
  parts: BlendPart[];
}

export function blendFigures(rows: FigureRow[], currentPeriod: string): Blended | null {
  const now = monthIndex(currentPeriod);
  // Per source and publisher: the newest figure that is still fresh.
  const newest = new Map<string, FigureRow>();
  for (const row of rows) {
    const source = row.source as MarketSource;
    if (!(source in FRESH_MONTHS) || !(row.value > 0)) continue;
    const age = now - monthIndex(row.period);
    if (age < 0 || age > FRESH_MONTHS[source]) continue;
    const key = `${row.source}|${row.sourceName}`;
    const seen = newest.get(key);
    if (!seen || monthIndex(row.period) > monthIndex(seen.period)) newest.set(key, row);
  }
  const parts: BlendPart[] = [...newest.values()].map((row) => {
    const source = row.source as MarketSource;
    const sample = source === "report" ? 1 : Math.min(1, Math.max(0, row.sampleSize) / FULL_SAMPLE[source]);
    // Older figures fade: a report from 8 months ago counts less than one from last month.
    const age = now - monthIndex(row.period);
    const freshness = 1 - age / (FRESH_MONTHS[source] + 1);
    return { ...row, weight: Math.round(sample * freshness * 1000) / 1000 };
  });
  const usable = parts.filter((part) => part.weight > 0);
  const total = usable.reduce((sum, part) => sum + part.weight, 0);
  if (total <= 0) return null;
  const value = usable.reduce((sum, part) => sum + part.value * part.weight, 0) / total;
  return { value, parts: usable.sort((a, b) => b.weight - a.weight) };
}

/** A robust centre for a sample: the median after dropping the outer 10% on each side. */
export function trimmedMedian(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const cut = Math.floor(sorted.length * 0.1);
  const kept = sorted.slice(cut, sorted.length - cut);
  const mid = Math.floor(kept.length / 2);
  return kept.length % 2 ? kept[mid] : (kept[mid - 1] + kept[mid]) / 2;
}
