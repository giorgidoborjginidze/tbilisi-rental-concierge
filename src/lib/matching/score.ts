import type { SearchCriteria } from "../criteria";
import {
  DISTRICT_ADJACENCY,
  type District,
} from "../domain";
import {
  DEFAULT_WEIGHTS,
  type MatchableListing,
  type MatchReason,
  type SoftSignalKey,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Days between two dates (a after b ⇒ positive). */
export function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / DAY_MS;
}

// --- Individual soft-scoring signals (each returns 0..1) --------------------

export function furnishedScore(
  criteria: SearchCriteria,
  l: MatchableListing,
): number | null {
  if (criteria.furnished === undefined) return null;
  return l.furnished === criteria.furnished ? 1 : 0;
}

export function heatingScore(
  criteria: SearchCriteria,
  l: MatchableListing,
): number | null {
  if (criteria.heating === undefined) return null;
  if (l.heating == null) return 0;
  if (l.heating === criteria.heating) return 1;
  // Different but still heated ⇒ partial credit; wanting/having "none" is 0.
  if (criteria.heating !== "none" && l.heating !== "none") return 0.4;
  return 0;
}

export function petsScore(
  criteria: SearchCriteria,
  l: MatchableListing,
): number | null {
  if (criteria.petsAllowed === undefined) return null;
  return l.petsAllowed === criteria.petsAllowed ? 1 : 0;
}

/**
 * Proximity to preferred districts. Exact match is weighted by preference rank
 * (earlier = higher); an adjacent district earns partial credit. Returns null
 * when the user expressed no district preference.
 */
export function districtScore(
  criteria: SearchCriteria,
  l: MatchableListing,
): number | null {
  const prefs = criteria.districts;
  if (!prefs || prefs.length === 0) return null;

  const idx = prefs.indexOf(l.district as District);
  if (idx >= 0) {
    // First preference = 1.0, each subsequent one slightly lower (floor 0.7).
    return Math.max(0.7, 1 - idx * 0.1);
  }

  // Adjacent to any preferred district?
  const adj = DISTRICT_ADJACENCY[l.district as District] ?? [];
  for (const pref of prefs) {
    if (adj.includes(pref)) return 0.5;
  }
  return 0;
}

/** Fresher listings score higher; decays linearly to 0 across the window. */
export function recencyScore(
  l: MatchableListing,
  now: Date,
  windowDays: number,
): number {
  const ageDays = Math.max(0, daysBetween(now, l.lastSeenAt));
  return clamp01(1 - ageDays / windowDays);
}

/** Cheaper-within-budget scores higher. Null when there's no budget ceiling. */
export function priceHeadroomScore(
  criteria: SearchCriteria,
  l: MatchableListing,
): number | null {
  if (criteria.maxPrice === undefined || criteria.maxPrice <= 0) return null;
  return clamp01((criteria.maxPrice - l.price) / criteria.maxPrice);
}

// --- Aggregate --------------------------------------------------------------

const LABELS: Record<SoftSignalKey, (l: MatchableListing, c: SearchCriteria) => string> = {
  district: (l) => `In a preferred district (${l.district})`,
  priceHeadroom: (l, c) =>
    c.maxPrice !== undefined
      ? `Under budget by $${Math.max(0, c.maxPrice - l.price)}`
      : "Good price",
  furnished: (l) => (l.furnished ? "Furnished as requested" : "Unfurnished as requested"),
  pets: (l) => (l.petsAllowed ? "Pets allowed" : "No-pets as requested"),
  recency: () => "Recently seen listing",
  heating: (l) => (l.heating ? `${l.heating} heating` : "Heating"),
};

/**
 * Weighted soft score in [0,1]. Only the signals the user expressed a preference
 * for (plus always-on recency) participate; their weights are normalized so the
 * result stays comparable regardless of how many criteria were given.
 */
export function scoreListing(
  criteria: SearchCriteria,
  listing: MatchableListing,
  opts: { now: Date; recencyWindowDays: number; weights: Record<SoftSignalKey, number> },
): { score: number; reasons: MatchReason[] } {
  const signals: { key: SoftSignalKey; value: number | null }[] = [
    { key: "district", value: districtScore(criteria, listing) },
    { key: "priceHeadroom", value: priceHeadroomScore(criteria, listing) },
    { key: "furnished", value: furnishedScore(criteria, listing) },
    { key: "pets", value: petsScore(criteria, listing) },
    { key: "heating", value: heatingScore(criteria, listing) },
    {
      key: "recency",
      value: recencyScore(listing, opts.now, opts.recencyWindowDays),
    },
  ];

  let weightSum = 0;
  let weighted = 0;
  const reasons: MatchReason[] = [];

  for (const { key, value } of signals) {
    if (value === null) continue;
    const w = opts.weights[key] ?? DEFAULT_WEIGHTS[key];
    weightSum += w;
    weighted += w * value;
    // Surface reasons for signals that meaningfully contributed.
    if (value >= 0.5) {
      reasons.push({ key, label: LABELS[key](listing, criteria), score: value });
    }
  }

  const score = weightSum > 0 ? weighted / weightSum : 0;
  reasons.sort((a, b) => b.score - a.score);
  return { score, reasons };
}
