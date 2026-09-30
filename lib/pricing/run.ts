// DB-bound orchestration: compute rule-based suggestions for a unit's
// upcoming dates, attach rationales (Claude or local stub), and persist
// them as PricingSuggestion rows (idempotent upsert per unit+date).

import { prisma } from "@/lib/db";
import { startOfTodayTbilisi } from "@/lib/time";
import { getMarketDataSource } from "@/lib/market/source";
import { suggestRate, type PricingResult } from "./engine";
import { generateRationales } from "@/lib/ai/rationale";
import type { Locale } from "@/lib/i18n/strings";
import { benchmarkMonth, occupancyShare } from "./nightly";
import { loadRentalPlaces } from "@/lib/property/places";
import { occupiedIntervals } from "@/lib/property/stays";

const DAY_MS = 86_400_000;

export interface SuggestionRow {
  date: Date;
  result: PricingResult;
  rationale: string;
}

const monthKey = benchmarkMonth;

export async function computeSuggestionsForUnit(
  unitId: string,
  locale: Locale,
  days = 14,
  today = new Date(),
): Promise<SuggestionRow[] | null> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return null;
  // No base rate yet (a unit made for an asset without a day price): no
  // price to build on.
  if (unit.baseNightlyRate <= 0) return [];

  const start = startOfTodayTbilisi(today);
  const next30End = new Date(start.getTime() + 30 * DAY_MS);

  // The unit's own occupancy over the next 30 days drives the demand
  // factor: its bookings and leases, and the contracts and daily answers
  // of the asset linked to it — one source per night.
  const [place] = await loadRentalPlaces(
    unit.operatorId,
    { start, end: next30End },
    { unitId },
  );
  const upcomingOccupancy = occupancyShare(
    place ? occupiedIntervals(place.sources) : [],
    start,
    30,
  );

  const market = getMarketDataSource();
  const benchmarkCache = new Map<string, number | null>();

  const rows: { date: Date; result: PricingResult }[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + i * DAY_MS);
    const month = monthKey(date);
    if (!benchmarkCache.has(month)) {
      const benchmark = await market.getBenchmark(unit.district, month);
      benchmarkCache.set(month, benchmark?.adr ?? null);
    }
    rows.push({
      date,
      result: suggestRate({
        baseNightlyRate: unit.baseNightlyRate,
        city: unit.city,
        date,
        upcomingOccupancy,
        benchmarkAdr: benchmarkCache.get(month),
      }),
    });
  }

  const rationales = await generateRationales(
    rows.map((row) => ({ date: row.date, result: row.result, currency: unit.currency })),
    {
      unitName: unit.name,
      district: unit.district,
      city: unit.city,
      baseNightlyRate: unit.baseNightlyRate,
      locale,
    },
  );

  const suggestions = rows.map((row, i) => ({
    ...row,
    rationale: rationales[i],
  }));

  for (const suggestion of suggestions) {
    await prisma.pricingSuggestion.upsert({
      where: { unitId_date: { unitId, date: suggestion.date } },
      create: {
        unitId,
        date: suggestion.date,
        suggestedRate: suggestion.result.suggestedRate,
        currency: unit.currency,
        reasons: {
          factors: suggestion.result.factors,
          reasons: suggestion.result.reasons,
          rationale: suggestion.rationale,
        },
      },
      update: {
        suggestedRate: suggestion.result.suggestedRate,
        reasons: {
          factors: suggestion.result.factors,
          reasons: suggestion.result.reasons,
          rationale: suggestion.rationale,
        },
      },
    });
  }

  return suggestions;
}
