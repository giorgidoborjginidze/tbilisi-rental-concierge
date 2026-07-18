import { prisma } from "./db";
import type { ListingSource, SourceListing } from "./sources/types";

// Ingestion service: pull listings from any ListingSource adapter and upsert
// them into the store keyed by (source, sourceUrl). Idempotent — re-running with
// the same source refreshes lastSeenAt rather than creating duplicates.

export interface SyncResult {
  source: string;
  fetched: number;
  created: number;
  updated: number;
  createdIds: string[];
}

function toCreateData(l: SourceListing) {
  return {
    source: l.source,
    sourceUrl: l.sourceUrl,
    type: l.type,
    propertyType: l.propertyType,
    district: l.district,
    addressApprox: l.addressApprox,
    price: l.price,
    currency: l.currency,
    areaSqm: l.areaSqm ?? null,
    rooms: l.rooms ?? null,
    bedrooms: l.bedrooms ?? null,
    floor: l.floor ?? null,
    furnished: l.furnished,
    heating: l.heating ?? null,
    petsAllowed: l.petsAllowed,
    availableFrom: l.availableFrom ?? null,
    postedAt: l.postedAt,
    lastSeenAt: l.lastSeenAt,
    isActive: true,
    rawText: l.rawText ?? null,
    rawTextKa: l.rawTextKa ?? null,
    photos: JSON.stringify(l.photos ?? []),
  };
}

export async function syncSource(source: ListingSource): Promise<SyncResult> {
  const listings = await source.fetchListings();
  const result: SyncResult = {
    source: source.key,
    fetched: listings.length,
    created: 0,
    updated: 0,
    createdIds: [],
  };

  for (const l of listings) {
    // sourceUrl is the stable external identity within a source.
    const existing = await prisma.listing.findFirst({
      where: { source: l.source, sourceUrl: l.sourceUrl },
      select: { id: true },
    });

    if (existing) {
      await prisma.listing.update({
        where: { id: existing.id },
        data: { ...toCreateData(l) },
      });
      result.updated += 1;
    } else {
      const created = await prisma.listing.create({ data: toCreateData(l) });
      result.created += 1;
      result.createdIds.push(created.id);
    }
  }

  return result;
}
