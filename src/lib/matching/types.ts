import type { SearchCriteria } from "../criteria";

// A framework-free, DB-free view of a listing that the matching engine operates
// on. Prisma rows are mapped to this at the API boundary, keeping the engine a
// pure function that's trivial to unit-test.
export interface MatchableListing {
  id: string;
  type: string;
  propertyType: string;
  district: string;
  addressApprox: string;
  price: number;
  currency: string;
  areaSqm: number | null;
  rooms: number | null;
  bedrooms: number | null;
  floor: number | null;
  furnished: boolean;
  heating: string | null;
  petsAllowed: boolean;
  availableFrom: Date | null;
  postedAt: Date;
  lastSeenAt: Date;
  isActive: boolean;
}

export interface MatchReason {
  /** Stable key for the signal, e.g. "district", "priceHeadroom". */
  key: string;
  /** Human-readable, English (the AI explanation is generated separately). */
  label: string;
  /** This signal's 0..1 contribution. */
  score: number;
}

export interface ScoredListing {
  listing: MatchableListing;
  /** Overall 0..1 soft score. */
  score: number;
  reasons: MatchReason[];
}

export interface MatchOptions {
  /** Reference "now" for recency/staleness/availability. Defaults to new Date(). */
  now?: Date;
  /** Listings not seen within this many days are excluded as stale. */
  staleAfterDays?: number;
  /** Recency scoring decays to 0 across this many days. */
  recencyWindowDays?: number;
  /** Only return matches at/above this soft score. */
  scoreThreshold?: number;
  /** Cap on returned matches. */
  maxResults?: number;
  /** Soft-score weights (per signal). Normalized over the active signals. */
  weights?: Partial<Record<SoftSignalKey, number>>;
}

export type SoftSignalKey =
  | "furnished"
  | "heating"
  | "pets"
  | "district"
  | "recency"
  | "priceHeadroom";

export const DEFAULT_WEIGHTS: Record<SoftSignalKey, number> = {
  district: 0.2,
  priceHeadroom: 0.2,
  furnished: 0.18,
  pets: 0.15,
  recency: 0.15,
  heating: 0.12,
};

export interface MatchResult {
  scored: ScoredListing[];
  stats: {
    total: number;
    passedHardGates: number;
    afterDedupe: number;
    afterStaleness: number;
    returned: number;
  };
}

export type { SearchCriteria };
