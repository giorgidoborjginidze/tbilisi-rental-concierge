import type { SearchCriteria } from "../criteria";
import type { MatchableListing } from "./types";

export interface GateResult {
  passed: boolean;
  /** Which gate rejected the listing (for debugging/explainability). */
  failedGate?: string;
}

const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Hard gates — every one must pass. Encodes the MVP's "must pass" rules:
 * type == rent, price ≤ max, rooms/bedrooms ≥ requested (or exact), district in
 * the requested set, and availableFrom ≤ the requested date. propertyType and
 * minimum area are also gated when explicitly requested.
 */
export function passesHardGates(
  criteria: SearchCriteria,
  listing: MatchableListing,
  now: Date = new Date(),
): GateResult {
  if (!listing.isActive) return { passed: false, failedGate: "inactive" };

  // type (rent/sale)
  if (listing.type !== criteria.type) {
    return { passed: false, failedGate: "type" };
  }

  // price ceiling / floor
  if (criteria.maxPrice !== undefined && listing.price > criteria.maxPrice) {
    return { passed: false, failedGate: "maxPrice" };
  }
  if (criteria.minPrice !== undefined && listing.price < criteria.minPrice) {
    return { passed: false, failedGate: "minPrice" };
  }

  // rooms (exact takes precedence over minimum)
  if (criteria.exactRooms !== undefined) {
    if (listing.rooms == null || listing.rooms !== criteria.exactRooms) {
      return { passed: false, failedGate: "exactRooms" };
    }
  } else if (criteria.minRooms !== undefined) {
    if (listing.rooms == null || listing.rooms < criteria.minRooms) {
      return { passed: false, failedGate: "minRooms" };
    }
  }

  // bedrooms (exact takes precedence over minimum)
  if (criteria.exactBedrooms !== undefined) {
    if (listing.bedrooms == null || listing.bedrooms !== criteria.exactBedrooms) {
      return { passed: false, failedGate: "exactBedrooms" };
    }
  } else if (criteria.minBedrooms !== undefined) {
    if (listing.bedrooms == null || listing.bedrooms < criteria.minBedrooms) {
      return { passed: false, failedGate: "minBedrooms" };
    }
  }

  // districts (hard gate when a preferred set is provided)
  if (criteria.districts && criteria.districts.length > 0) {
    if (!criteria.districts.includes(listing.district as never)) {
      return { passed: false, failedGate: "district" };
    }
  }

  // property type (hard gate when specified)
  if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
    if (!criteria.propertyTypes.includes(listing.propertyType as never)) {
      return { passed: false, failedGate: "propertyType" };
    }
  }

  // minimum area (hard gate when specified)
  if (criteria.minAreaSqm !== undefined) {
    if (listing.areaSqm == null || listing.areaSqm < criteria.minAreaSqm) {
      return { passed: false, failedGate: "minAreaSqm" };
    }
  }

  // availability: listing must be available on or before the requested date
  if (criteria.availableFrom !== undefined) {
    const requested = startOfDay(new Date(`${criteria.availableFrom}T00:00:00`));
    // null availableFrom ⇒ available now ⇒ passes.
    if (listing.availableFrom != null) {
      if (startOfDay(listing.availableFrom).getTime() > requested.getTime()) {
        return { passed: false, failedGate: "availableFrom" };
      }
    }
  }

  return { passed: true };
}
