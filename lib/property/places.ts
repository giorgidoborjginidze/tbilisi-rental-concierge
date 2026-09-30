// The rentable places of a workspace, loaded once for the Rentals pages
// (calendar, analytics), the hotel dashboard, the free-window prices and
// the vacancy alerts. Server-only (Prisma).
//
// A place is:
//   - every Unit, together with the real-estate Asset linked to it (the
//     asset's contracts and daily answers belong to the unit's row), and
//   - every real-estate Asset let by the day that has no unit yet (added
//     before units and assets were linked; saving it in daily mode gives
//     it one — lib/property/link.ts).
// Assets let long-term without a unit live on /assets and their rental
// desk; their contracts appear here only through a linked unit.

import { prisma } from "@/lib/db";
import { LIVE_STAY } from "@/lib/bookings/live";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import type { Booking, Unit } from "@/app/generated/prisma/client";
import { emptySources, type PlaceSources } from "./stays";

export interface RentalPlace {
  /** The unit id, or "asset:<id>" for a day-let asset without a unit. */
  key: string;
  unit: (Unit & { bookings: Booking[] }) | null;
  asset: {
    id: string;
    name: string;
    nameKa: string | null;
    rentalMode: string;
    dailyRate: number | null;
    currency: string;
  } | null;
  name: string;
  nameKa: string | null;
  city: string | null;
  district: string | null;
  currency: string;
  sources: PlaceSources;
}

interface Range {
  start: Date;
  end: Date;
}

const assetSelect = (range: Range) => ({
  id: true,
  operatorId: true,
  name: true,
  nameKa: true,
  city: true,
  district: true,
  rentalMode: true,
  dailyRate: true,
  weekendPct: true,
  holidayPct: true,
  currency: true,
  contracts: {
    where: { startDate: { lt: range.end }, endDate: { gt: range.start }, ...LIVE_CONTRACT },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      paymentPeriod: true,
      paymentAmount: true,
      monthlyRent: true,
    },
  },
  days: {
    where: { rented: true, date: { gte: range.start, lt: range.end } },
    select: { date: true, amount: true },
  },
});

/** Only real estate joins the Rentals pages (cars have the fleet page). */
export const DAY_LET_WITHOUT_UNIT = {
  category: "real_estate",
  rentalMode: "daily",
  unitId: null,
} as const;

/**
 * Every place of the workspace with everything that takes its nights
 * inside [range.start, range.end). With `unitId`, that unit alone.
 */
export async function loadRentalPlaces(
  operatorId: string,
  range: Range,
  opts: { unitId?: string } = {},
): Promise<RentalPlace[]> {
  const [units, loose] = await Promise.all([
    prisma.unit.findMany({
      where: { operatorId, ...(opts.unitId ? { id: opts.unitId } : {}) },
      orderBy: [{ city: "asc" }, { district: "asc" }, { name: "asc" }],
      include: {
        bookings: {
          where: { ...LIVE_STAY, checkIn: { lt: range.end }, checkOut: { gt: range.start } },
          orderBy: { checkIn: "asc" },
        },
        leases: {
          where: { startDate: { lt: range.end }, endDate: { gt: range.start } },
          select: { id: true, startDate: true, endDate: true },
        },
        asset: { select: assetSelect(range) },
      },
    }),
    opts.unitId
      ? Promise.resolve([])
      : prisma.asset.findMany({
          where: { operatorId, ...DAY_LET_WITHOUT_UNIT },
          orderBy: { name: "asc" },
          select: assetSelect(range),
        }),
  ]);

  const places: RentalPlace[] = units.map(({ leases, asset: linked, ...unit }) => {
    // Second safeguard: only this workspace's own asset speaks for the unit
    // (a cross-workspace link left in legacy or team data is ignored).
    const asset = linked && linked.operatorId === operatorId ? linked : null;
    return {
    key: unit.id,
    unit,
    asset: asset
      ? {
          id: asset.id,
          name: asset.name,
          nameKa: asset.nameKa,
          rentalMode: asset.rentalMode,
          dailyRate: asset.dailyRate,
          currency: asset.currency,
        }
      : null,
    name: unit.name,
    nameKa: unit.nameKa,
    city: unit.city,
    district: unit.district,
    currency: unit.currency,
    sources: {
      bookings: unit.bookings,
      leases,
      contracts: asset?.contracts ?? [],
      days: asset?.days ?? [],
      dailyMode: asset?.rentalMode === "daily",
      weekendPct: asset?.weekendPct ?? 0,
      holidayPct: asset?.holidayPct ?? 0,
    },
  };
  });

  for (const asset of loose) {
    places.push({
      key: `asset:${asset.id}`,
      unit: null,
      asset: {
        id: asset.id,
        name: asset.name,
        nameKa: asset.nameKa,
        rentalMode: asset.rentalMode,
        dailyRate: asset.dailyRate,
        currency: asset.currency,
      },
      name: asset.name,
      nameKa: asset.nameKa,
      city: asset.city,
      district: asset.district,
      currency: asset.currency,
      sources: {
        ...emptySources(),
        contracts: asset.contracts,
        days: asset.days,
        dailyMode: true,
        weekendPct: asset.weekendPct ?? 0,
        holidayPct: asset.holidayPct ?? 0,
      },
    });
  }
  return places;
}

/** Where a place's name leads: its calendar row, or the asset's own page. */
export const placeHref = (place: RentalPlace, month?: string): string =>
  place.unit
    ? `/calendar?${month ? `month=${month}&` : ""}unit=${place.unit.id}`
    : `/assets/${place.asset!.id}/edit`;

/**
 * The nights of given assets — their contracts and daily answers, plus the
 * bookings and leases of the unit linked to each — over [range.start,
 * range.end). For the asset's own calendar, the dashboard's daily question
 * and the nights marked on the asset calendar.
 */
export async function loadAssetSources(
  operatorId: string,
  assetIds: string[],
  range: Range,
): Promise<Map<string, PlaceSources>> {
  if (assetIds.length === 0) return new Map();
  const assets = await prisma.asset.findMany({
    where: { operatorId, id: { in: assetIds } },
    select: {
      ...assetSelect(range),
      unit: {
        select: {
          operatorId: true,
          bookings: {
            where: { ...LIVE_STAY, checkIn: { lt: range.end }, checkOut: { gt: range.start } },
            select: { id: true, source: true, checkIn: true, checkOut: true, nights: true, amount: true },
          },
          leases: {
            where: { startDate: { lt: range.end }, endDate: { gt: range.start } },
            select: { id: true, startDate: true, endDate: true },
          },
        },
      },
    },
  });
  return new Map(
    assets.map((asset) => {
      // Second safeguard: only this workspace's own unit's stays.
      const unit = asset.unit && asset.unit.operatorId === operatorId ? asset.unit : null;
      return [
      asset.id,
      {
        bookings: unit?.bookings ?? [],
        leases: unit?.leases ?? [],
        contracts: asset.contracts,
        days: asset.days,
        dailyMode: asset.rentalMode === "daily",
        weekendPct: asset.weekendPct ?? 0,
        holidayPct: asset.holidayPct ?? 0,
      },
    ] as const;
    }),
  );
}
