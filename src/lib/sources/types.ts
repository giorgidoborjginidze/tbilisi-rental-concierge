import type {
  District,
  HeatingType,
  ListingType,
  PropertyType,
} from "../domain";

// The normalized shape every ingestion source must emit. This is deliberately
// decoupled from Prisma's model so a source never needs to know how we persist.
export interface SourceListing {
  /** Stable identifier within the source, used for upserts / de-dup on re-poll. */
  externalId: string;
  source: string;
  sourceUrl: string;
  type: ListingType;
  propertyType: PropertyType;
  district: District;
  addressApprox: string;
  price: number;
  currency: string;
  areaSqm?: number;
  rooms?: number;
  bedrooms?: number;
  floor?: number;
  furnished: boolean;
  heating?: HeatingType;
  petsAllowed: boolean;
  availableFrom?: Date;
  postedAt: Date;
  lastSeenAt: Date;
  rawText?: string;
  rawTextKa?: string;
  photos: string[];
}

/**
 * Pluggable ingestion adapter. The MVP ships only a MockSource, but real
 * portals / partner feeds get added later behind this same interface — the rest
 * of the system never changes.
 */
export interface ListingSource {
  /** Unique adapter key persisted on each Listing (e.g. "mock"). */
  readonly key: string;

  /**
   * Return the current set of listings from this source. Implementations should
   * be idempotent: repeated calls return stable `externalId`s so callers can
   * upsert rather than duplicate.
   */
  fetchListings(): Promise<SourceListing[]>;
}
