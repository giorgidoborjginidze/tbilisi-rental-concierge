// The market figure a screen shows for a district: the blend of what the
// admin entered (reports, listing aggregates) and what Activo's customers'
// own data says (lib/market/activo.ts), else the built-in estimate. Every
// answer says which it is, so a page can name its sources.

import { cache } from "react";
import { prisma } from "@/lib/db";
import { districtKey } from "@/lib/places";
import { monthKeyTbilisi } from "@/lib/time";
import { PRICE_PER_SQM } from "@/lib/invest/market";
import { blendFigures, type BlendPart, type MarketMetric } from "./blend";
import { seededMany, seededMarketBenchmark, seededRentBenchmark } from "./seeded";

export interface MarketAnswer {
  value: number;
  /** The figures it rests on; empty for the built-in estimate. */
  parts: BlendPart[];
  /** True when no real figure was available and the built-in estimate is shown. */
  estimate: boolean;
}

/** Every figure of one metric, for every district, read once per request. */
const figuresOf = cache(async (metric: MarketMetric) =>
  prisma.marketFigure
    .findMany({ where: { metric }, select: { district: true, source: true, sourceName: true, period: true, value: true, sampleSize: true } })
    .catch(() => []),
);

/** The built-in estimates the app started with. */
const estimateOf = cache(async (metric: MarketMetric, district: string, month: string): Promise<number | null> => {
  if (metric === "sale_sqm") return PRICE_PER_SQM[district] ?? null;
  if (metric === "rent_sqm") {
    const row = await seededRentBenchmark(district, month);
    return row?.avgRentPerSqm ?? null;
  }
  const row = await seededMarketBenchmark(district, month);
  return row ? (metric === "adr" ? row.adr : row.occupancyRate) : null;
});

export async function marketFigure(
  districtInput: string | null | undefined,
  metric: MarketMetric,
  month: string = monthKeyTbilisi(),
): Promise<MarketAnswer | null> {
  const district = districtKey(districtInput);
  if (!district) return null;
  const rows = (await figuresOf(metric)).filter((row) => row.district === district);
  const blended = blendFigures(rows, month);
  if (blended) return { value: blended.value, parts: blended.parts, estimate: false };
  const estimate = await estimateOf(metric, district, month);
  return estimate != null ? { value: estimate, parts: [], estimate: true } : null;
}

/** One metric for many districts at once (the calculators' district lists). */
export async function marketFigures(
  districts: readonly string[],
  metric: MarketMetric,
  month: string = monthKeyTbilisi(),
): Promise<Record<string, MarketAnswer>> {
  const keys = [...new Set(districts.map((d) => districtKey(d)).filter((k): k is string => !!k))];
  // Two reads in all, whatever the number of districts: every figure of the
  // metric, and the built-in estimates of every district for the month.
  const [rows, estimates] = await Promise.all([figuresOf(metric), estimatesOf(metric, keys, month)]);
  const out: Record<string, MarketAnswer> = {};
  for (const district of districts) {
    const key = districtKey(district);
    if (!key) continue;
    const blended = blendFigures(rows.filter((row) => row.district === key), month);
    if (blended) {
      out[district] = { value: blended.value, parts: blended.parts, estimate: false };
      continue;
    }
    const estimate = estimates.get(key);
    if (estimate != null) out[district] = { value: estimate, parts: [], estimate: true };
  }
  return out;
}

/** The built-in estimates of many districts for one month, in one read. */
async function estimatesOf(metric: MarketMetric, districts: string[], month: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (metric === "sale_sqm") {
    for (const district of districts) if (PRICE_PER_SQM[district] != null) out.set(district, PRICE_PER_SQM[district]);
    return out;
  }
  if (metric === "rent_sqm") {
    for (const [district, row] of await seededMany("rent", districts, month)) out.set(district, row.avgRentPerSqm);
    return out;
  }
  for (const [district, row] of await seededMany("market", districts, month)) {
    out.set(district, metric === "adr" ? row.adr : row.occupancyRate);
  }
  return out;
}

/**
 * One line naming every source behind many figures (a page's districts):
 * each report once with its newest month, each listing source and Activo's
 * own data once with their largest sample. Null when all are estimates.
 */
export function summarizeSources(
  answers: (Pick<MarketAnswer, "parts" | "estimate"> | null | undefined)[],
  words: { listings: string; activo: string },
): string | null {
  const reports = new Map<string, string>();
  const counted = new Map<string, number>();
  for (const answer of answers) {
    if (!answer || answer.estimate) continue;
    for (const part of answer.parts) {
      if (part.source === "report") {
        const name = part.sourceName || "—";
        if (!reports.has(name) || reports.get(name)! < part.period) reports.set(name, part.period);
      } else {
        const name = part.source === "listings" ? part.sourceName || words.listings : words.activo;
        counted.set(name, Math.max(counted.get(name) ?? 0, part.sampleSize));
      }
    }
  }
  const out = [
    ...[...reports].map(([name, period]) => `${name} ${period}`),
    ...[...counted].map(([name, n]) => `${name} (${n})`),
  ];
  return out.length ? out.join(" · ") : null;
}

/** "TBC Capital 2026-09 · listings (124) · Activo (12)": where a figure came from. */
export function describeSources(
  answer: Pick<MarketAnswer, "parts" | "estimate"> | null,
  words: { estimate: string; listings: string; activo: string },
): string {
  if (!answer || answer.estimate || answer.parts.length === 0) return words.estimate;
  return answer.parts
    .map((part) =>
      part.source === "report"
        ? `${part.sourceName || "—"} ${part.period}`
        : `${part.source === "listings" ? (part.sourceName || words.listings) : words.activo} (${part.sampleSize})`,
    )
    .join(" · ");
}
