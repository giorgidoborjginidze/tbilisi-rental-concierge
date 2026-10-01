// One property, entered either way. A Unit (Rentals) and a real-estate
// Asset (portfolio) of the same flat are linked through Asset.unitId, and
// since this package the link is made for the owner:
//
//   - creating a Unit creates its Asset (real estate, let by the day, no
//     value yet) unless the owner picked an existing asset to link;
//   - a real-estate Asset let by the day — or given iCal links — gets its
//     Unit, so the flat shows in the calendar, bookings, analytics and the
//     free-window prices;
//   - deleting one side deletes the other only while it holds nothing of
//     its own (see unitHoldsNothing / assetHoldsNothing).
//
// Rows added before (unlinked units, unlinked assets) stay valid: an
// unlinked day-let asset still shows in the calendar (lib/property/places)
// and gets its unit from the "Add to Rentals" button (or when it gains
// iCal links). scripts/link-properties.ts links pairs that already exist
// under the same name — nothing else.
//
// The mapping helpers are pure; the rest takes a Prisma client or a
// transaction.

import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { parseChannelLinks } from "@/lib/types";

type Db = PrismaClient | Prisma.TransactionClient;

/** The asset type of a unit type (an aparthotel room is a flat). */
export const assetTypeOfUnit = (unitType: string): string =>
  unitType === "house" ? "house" : "apartment";

/** The unit type of an asset type (commercial space, land, garage → apartment). */
export const unitTypeOfAsset = (assetType: string): string =>
  assetType === "house" ? "house" : "apartment";

/** A real-estate asset that should be on the Rentals calendar. */
export const wantsUnit = (asset: {
  category: string;
  rentalMode: string;
  icalCount: number;
}): boolean =>
  asset.category === "real_estate" && (asset.rentalMode === "daily" || asset.icalCount > 0);

/**
 * Whether saving an asset creates its calendar unit. Only at a change that
 * puts the flat on the calendar: when the asset is created (let by the day
 * or with iCal links), when it moves into daily mode, or when it gains iCal
 * links. Never while a unit is picked, never in the save that removes the
 * link by hand, and never again on a later save of a flat whose link the
 * owner removed (an old loose flat has the "Add to Rentals" button).
 */
export function shouldCreateUnit(input: {
  category: string;
  rentalMode: string;
  /** The unit picked in the form (null: none). */
  pickedUnitId: string | null;
  /** The asset as stored before this save; null when it is being created. */
  previous: { rentalMode: string; unitId: string | null } | null;
  /** iCal links this save adds (see icalLinksAdded). */
  addedIcal: number;
}): boolean {
  if (input.category !== "real_estate" || input.pickedUnitId) return false;
  if (!input.previous) {
    return wantsUnit({ category: input.category, rentalMode: input.rentalMode, icalCount: input.addedIcal });
  }
  if (input.previous.unitId) return false;
  const becameDaily = input.previous.rentalMode !== "daily" && input.rentalMode === "daily";
  return becameDaily || input.addedIcal > 0;
}

/** The links typed now that were not in the textarea when the form was shown. */
export const icalLinksAdded = (typed: string[], shown: string[]): string[] =>
  typed.filter((url) => !shown.includes(url));

/**
 * The iCal links a linked unit keeps after its asset is saved, or null when
 * nothing changes. The asset form's textarea shows the links of the unit
 * the asset was linked to when the page was drawn (`shownFor`); only that
 * unit's list is replaced by what was typed — removing a line removes the
 * link. A unit picked in this save (a first link, or a switch from another
 * unit) never loses its own links: it only gains the lines the owner
 * added, never the other unit's links that were prefilled.
 */
export function unitFeedsAfterSave(input: {
  /** The unit the asset is linked to after this save. */
  unitId: string;
  /** The unit whose links the textarea was prefilled from (null: none). */
  shownFor: string | null;
  /** The textarea's prefilled links. */
  shown: string[];
  /** What was submitted. */
  typed: string[];
  /** The unit's links as stored now. */
  current: string[];
}): string[] | null {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((url, i) => url === b[i]);
  if (input.shownFor === input.unitId) {
    return same(input.typed, input.current) ? null : input.typed;
  }
  const added = icalLinksAdded(input.typed, input.shown).filter((url) => !input.current.includes(url));
  return added.length > 0 ? [...input.current, ...added] : null;
}

/**
 * Whether the dashboard asks "rented today?" about a day-let asset. Not for
 * a flat whose calendar unit has channel feeds (iCal): the channel is the
 * record of its nights, and a hotel would otherwise be asked about every
 * free room every day. Loose day-let flats, linked units without feeds and
 * day-let cars are asked.
 */
export const asksDailyQuestion = (asset: {
  rentalMode: string;
  /** `bookings`: live stays on the unit's calendar (entered by hand or synced). */
  unit: { channelLinks: unknown; bookings?: number } | null;
}): boolean =>
  asset.rentalMode === "daily" &&
  (!asset.unit ||
    // A room whose calendar is kept — by channel feeds or bookings typed
    // in — has its record there; asking every morning would only repeat it.
    (parseChannelLinks(asset.unit.channelLinks).icalUrls.length === 0 && (asset.unit.bookings ?? 0) === 0));

export interface UnitForAsset {
  name: string;
  nameKa: string | null;
  city: string;
  district: string;
  address: string;
  type: string;
  capacity: number;
  bedrooms: number;
  baseNightlyRate: number;
  currency: string;
  amenities: string[];
  channelLinks: { airbnbUrl: string | null; bookingUrl: string | null; icalUrls: string[] };
}

/**
 * The unit a real-estate asset is given. Capacity and bedrooms are
 * placeholders the owner can correct on the unit; the base nightly rate is
 * the asset's day rate, else `fallbackRate` (the district's average night
 * — a starting point for the price suggestions, not a price anyone is
 * charged), else 0 (no suggestions until a rate is set).
 */
export function unitFromAsset(
  asset: {
    name: string;
    nameKa: string | null;
    city: string | null;
    district: string | null;
    address: string | null;
    type: string;
    dailyRate: number | null;
    currency: string;
    airbnbUrl: string | null;
    bookingUrl: string | null;
  },
  icalUrls: string[],
  fallbackRate: number | null,
): UnitForAsset {
  const rate =
    asset.dailyRate != null && asset.dailyRate > 0
      ? asset.dailyRate
      : fallbackRate != null && fallbackRate > 0
        ? Math.round(fallbackRate)
        : 0;
  return {
    name: asset.name,
    nameKa: asset.nameKa,
    city: asset.city || "Tbilisi",
    district: asset.district ?? "",
    address: asset.address ?? "",
    type: unitTypeOfAsset(asset.type),
    capacity: 2,
    bedrooms: 1,
    baseNightlyRate: rate,
    currency: asset.currency || "GEL",
    amenities: [],
    channelLinks: {
      airbnbUrl: asset.airbnbUrl,
      bookingUrl: asset.bookingUrl,
      icalUrls,
    },
  };
}

/** The asset a new unit is given: real estate, let by the day, no value yet. */
export function assetFromUnit(unit: {
  operatorId: string;
  id: string;
  name: string;
  nameKa: string | null;
  city: string;
  district: string;
  address: string;
  type: string;
  baseNightlyRate: number;
  currency: string;
  channelLinks: unknown;
}) {
  const links = parseChannelLinks(unit.channelLinks);
  return {
    operatorId: unit.operatorId,
    unitId: unit.id,
    name: unit.name,
    nameKa: unit.nameKa,
    category: "real_estate",
    type: assetTypeOfUnit(unit.type),
    city: unit.city || null,
    district: unit.district || null,
    address: unit.address || null,
    estimatedValue: null,
    currency: unit.currency || "GEL",
    // Let by the night: the unit's calendar says when it is taken.
    status: "vacant",
    statusSetAt: new Date(),
    rentalMode: "daily",
    dailyRate: unit.baseNightlyRate > 0 ? unit.baseNightlyRate : null,
    airbnbUrl: links.airbnbUrl ?? null,
    bookingUrl: links.bookingUrl ?? null,
  };
}

/** Create the asset of a unit that has none; returns its id. */
export async function createAssetForUnit(
  db: Db,
  unit: Parameters<typeof assetFromUnit>[0],
): Promise<string> {
  const asset = await db.asset.create({ data: assetFromUnit(unit), select: { id: true } });
  return asset.id;
}

/** Create the unit of a real-estate asset that has none, and link it. */
export async function createUnitForAsset(
  db: Db,
  operatorId: string,
  asset: Parameters<typeof unitFromAsset>[0] & { id: string },
  icalUrls: string[],
  fallbackRate: number | null,
): Promise<string> {
  const unit = await db.unit.create({
    data: { operatorId, ...unitFromAsset(asset, icalUrls, fallbackRate) },
    select: { id: true },
  });
  await db.asset.update({ where: { id: asset.id }, data: { unitId: unit.id } });
  return unit.id;
}

/** Nothing but the link: no stays, no leases, no calendar feeds. */
export async function unitHoldsNothing(db: Db, unitId: string): Promise<boolean> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { channelLinks: true, _count: { select: { bookings: true, leases: true } } },
  });
  if (!unit) return false;
  return (
    unit._count.bookings === 0 &&
    unit._count.leases === 0 &&
    parseChannelLinks(unit.channelLinks).icalUrls.length === 0
  );
}

/** Nothing but the link: no value, contracts, daily answers, income or notes. */
export async function assetHoldsNothing(db: Db, assetId: string): Promise<boolean> {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      estimatedValue: true,
      notes: true,
      // all-contracts: a deleted contract is kept for undo and its payment
      // history — the asset holding it is not "nothing" and stays.
      _count: { select: { contracts: true, days: true, incomes: true } },
    },
  });
  if (!asset) return false;
  return (
    asset.estimatedValue == null &&
    !asset.notes &&
    asset._count.contracts === 0 &&
    asset._count.days === 0 &&
    asset._count.incomes === 0
  );
}

/**
 * Pairs that are obviously one property: an unlinked unit and an unlinked
 * real-estate asset of the same workspace with an identical name (exactly
 * the same text), where that name is unique on both sides — two units or
 * two assets of one name are left alone. Pure — used by
 * scripts/link-properties.ts.
 */
export function namePairs(
  units: { id: string; operatorId: string; name: string }[],
  assets: { id: string; operatorId: string; name: string }[],
): { unitId: string; assetId: string }[] {
  const key = (row: { operatorId: string; name: string }) => `${row.operatorId}|${row.name}`;
  const group = <T extends { operatorId: string; name: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      if (!row.name.trim()) continue;
      map.set(key(row), [...(map.get(key(row)) ?? []), row]);
    }
    return map;
  };
  const unitsByName = group(units);
  const assetsByName = group(assets);
  const pairs: { unitId: string; assetId: string }[] = [];
  for (const [name, sameUnits] of unitsByName) {
    const sameAssets = assetsByName.get(name);
    if (sameUnits.length === 1 && sameAssets?.length === 1) {
      pairs.push({ unitId: sameUnits[0].id, assetId: sameAssets[0].id });
    }
  }
  return pairs;
}
