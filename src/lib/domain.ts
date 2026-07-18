// Shared domain vocabulary for Tbilisi rentals.
//
// Kept framework-free so both the AI-extraction layer and the (pure) matching
// engine can depend on it without pulling in Next.js or Prisma.

/** Canonical districts we support in the MVP. */
export const DISTRICTS = [
  "Vake",
  "Vera",
  "Saburtalo",
  "Mtatsminda",
  "Sololaki", // Old Town / Sololaki
  "Gldani",
  "Didi Digomi",
  "Isani",
] as const;

export type District = (typeof DISTRICTS)[number];

/** Georgian display names, keyed by canonical district. */
export const DISTRICT_KA: Record<District, string> = {
  Vake: "ვაკე",
  Vera: "ვერა",
  Saburtalo: "საბურთალო",
  Mtatsminda: "მთაწმინდა",
  Sololaki: "სოლოლაკი",
  Gldani: "გლდანი",
  "Didi Digomi": "დიდი დიღომი",
  Isani: "ისანი",
};

/**
 * Rough adjacency graph between districts, used by the "proximity to preferred
 * districts" soft-scoring signal. Not geographically exact — a pragmatic MVP
 * approximation of which neighbourhoods a renter would consider interchangeable.
 */
export const DISTRICT_ADJACENCY: Record<District, District[]> = {
  Vake: ["Vera", "Saburtalo", "Mtatsminda"],
  Vera: ["Vake", "Mtatsminda", "Saburtalo", "Sololaki"],
  Saburtalo: ["Vake", "Vera", "Didi Digomi"],
  Mtatsminda: ["Vera", "Vake", "Sololaki"],
  Sololaki: ["Mtatsminda", "Vera", "Isani"],
  Gldani: ["Didi Digomi"],
  "Didi Digomi": ["Saburtalo", "Gldani"],
  Isani: ["Sololaki"],
};

export const PROPERTY_TYPES = [
  "apartment",
  "house",
  "studio",
  "room",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const HEATING_TYPES = [
  "central",
  "gas",
  "electric",
  "none",
] as const;
export type HeatingType = (typeof HEATING_TYPES)[number];

export const LISTING_TYPES = ["rent", "sale"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LANGUAGES = ["en", "ka"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Case-insensitive resolution of a free-text district name to a canonical one. */
export function normalizeDistrict(input: string): District | null {
  const q = input.trim().toLowerCase();
  if (!q) return null;

  const aliases: Record<string, District> = {
    "old town": "Sololaki",
    "oldtown": "Sololaki",
    "old tbilisi": "Sololaki",
    "sololaki": "Sololaki",
    "vera": "Vera",
    "vake": "Vake",
    "saburtalo": "Saburtalo",
    "mtatsminda": "Mtatsminda",
    "gldani": "Gldani",
    "didi digomi": "Didi Digomi",
    "digomi": "Didi Digomi",
    "isani": "Isani",
  };

  if (aliases[q]) return aliases[q];

  // Match Georgian names too.
  for (const d of DISTRICTS) {
    if (DISTRICT_KA[d].toLowerCase() === q) return d;
    if (d.toLowerCase() === q) return d;
  }
  return null;
}
