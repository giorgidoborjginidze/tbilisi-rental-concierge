import type { Listing } from "@prisma/client";
import type { MatchableListing } from "./matching/types";

/** Map a persisted Prisma row into the engine's framework-free shape. */
export function toMatchable(l: Listing): MatchableListing {
  return {
    id: l.id,
    type: l.type,
    propertyType: l.propertyType,
    district: l.district,
    addressApprox: l.addressApprox,
    price: l.price,
    currency: l.currency,
    areaSqm: l.areaSqm,
    rooms: l.rooms,
    bedrooms: l.bedrooms,
    floor: l.floor,
    furnished: l.furnished,
    heating: l.heating,
    petsAllowed: l.petsAllowed,
    availableFrom: l.availableFrom,
    postedAt: l.postedAt,
    lastSeenAt: l.lastSeenAt,
    isActive: l.isActive,
  };
}

/** Safely parse the JSON-encoded photos column into a string[]. */
export function parsePhotos(photos: string): string[] {
  try {
    const parsed = JSON.parse(photos);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}
