import type { SearchCriteria } from "../criteria";
import { dedupeListings } from "./dedupe";
import { passesHardGates } from "./gates";
import { daysBetween, scoreListing } from "./score";
import {
  DEFAULT_WEIGHTS,
  type MatchOptions,
  type MatchResult,
  type MatchableListing,
  type ScoredListing,
  type SoftSignalKey,
} from "./types";

const DEFAULTS = {
  staleAfterDays: 21,
  recencyWindowDays: 30,
  scoreThreshold: 0.35,
  maxResults: 25,
};

/**
 * The matching engine — a pure function.
 *
 * Pipeline:
 *   1. staleness filter  (drop listings not seen within `staleAfterDays`)
 *   2. hard gates        (must-pass criteria)
 *   3. de-duplication    (collapse near-duplicates, keep the freshest)
 *   4. soft scoring      (weighted 0..1) + reasons
 *   5. threshold + rank  (sort by score, cap results)
 *
 * No I/O, no framework, no clock beyond the injectable `now`.
 */
export function runMatching(
  criteria: SearchCriteria,
  listings: MatchableListing[],
  options: MatchOptions = {},
): MatchResult {
  const now = options.now ?? new Date();
  const staleAfterDays = options.staleAfterDays ?? DEFAULTS.staleAfterDays;
  const recencyWindowDays =
    options.recencyWindowDays ?? DEFAULTS.recencyWindowDays;
  const scoreThreshold = options.scoreThreshold ?? DEFAULTS.scoreThreshold;
  const maxResults = options.maxResults ?? DEFAULTS.maxResults;
  const weights: Record<SoftSignalKey, number> = {
    ...DEFAULT_WEIGHTS,
    ...options.weights,
  };

  const total = listings.length;

  // 1. staleness
  const fresh = listings.filter(
    (l) => daysBetween(now, l.lastSeenAt) <= staleAfterDays,
  );
  const afterStaleness = fresh.length;

  // 2. hard gates
  const gated = fresh.filter((l) => passesHardGates(criteria, l, now).passed);
  const passedHardGates = gated.length;

  // 3. de-duplication
  const deduped = dedupeListings(gated);
  const afterDedupe = deduped.length;

  // 4. soft scoring
  const scored: ScoredListing[] = deduped.map((listing) => {
    const { score, reasons } = scoreListing(criteria, listing, {
      now,
      recencyWindowDays,
      weights,
    });
    return { listing, score, reasons };
  });

  // 5. threshold + rank
  const ranked = scored
    .filter((s) => s.score >= scoreThreshold)
    .sort((a, b) => b.score - a.score || tiebreak(a, b))
    .slice(0, maxResults);

  return {
    scored: ranked,
    stats: {
      total,
      afterStaleness,
      passedHardGates,
      afterDedupe,
      returned: ranked.length,
    },
  };
}

/** Deterministic tiebreak: fresher, then cheaper, then id. */
function tiebreak(a: ScoredListing, b: ScoredListing): number {
  const freshness =
    b.listing.lastSeenAt.getTime() - a.listing.lastSeenAt.getTime();
  if (freshness !== 0) return freshness;
  const price = a.listing.price - b.listing.price;
  if (price !== 0) return price;
  return a.listing.id.localeCompare(b.listing.id);
}
