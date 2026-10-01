// DB-bound orchestration: compute rule-based suggestions for a unit's
// upcoming dates and attach rationales (Claude or local stub). Nothing is
// stored: the page and the export compute them fresh (the PricingSuggestion
// table is no longer written).

import { prisma } from "@/lib/db";
import { startOfTodayTbilisi } from "@/lib/time";
import { benchmarkAdrIn, getMarketDataSource } from "@/lib/market/source";
import { suggestRate, type PricingResult } from "./engine";
import { generateRationales } from "@/lib/ai/rationale";
import type { Locale } from "@/lib/i18n/strings";
import { benchmarkMonth, placeOccupancy } from "./nightly";
import { loadRentalPlaces } from "@/lib/property/places";

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
  const upcomingOccupancy = place ? placeOccupancy(place.sources, start, 30) : 0;

  const market = getMarketDataSource();
  const dates = Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  // Each month's district benchmark, all months asked at once.
  const months = [...new Set(dates.map(monthKey))];
  const benchmarks = new Map(
    await Promise.all(
      months.map(async (month) => [month, await benchmarkAdrIn(market, unit.district, month, unit.currency)] as const),
    ),
  );

  const rows: { date: Date; result: PricingResult }[] = dates.map((date) => ({
    date,
    result: suggestRate({
      baseNightlyRate: unit.baseNightlyRate,
      city: unit.city,
      date,
      upcomingOccupancy,
      benchmarkAdr: benchmarks.get(monthKey(date)),
    }),
  }));

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

  return suggestions;
}
