import {
  DISTRICTS,
  DISTRICT_KA,
  HEATING_TYPES,
  PROPERTY_TYPES,
  type District,
  type HeatingType,
  type PropertyType,
} from "../domain";
import { Rng } from "./rng";
import type { ListingSource, SourceListing } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

// Plausible street stems per district (approximate, for addressApprox only —
// never a precise address). Georgian equivalents kept loosely parallel.
const STREETS: Record<District, { en: string; ka: string }[]> = {
  Vake: [
    { en: "Chavchavadze Ave", ka: "ჭავჭავაძის გამზ." },
    { en: "Abashidze St", ka: "აბაშიძის ქ." },
    { en: "Paliashvili St", ka: "ფალიაშვილის ქ." },
  ],
  Vera: [
    { en: "Kiacheli St", ka: "კიაჩელის ქ." },
    { en: "Kostava St", ka: "კოსტავას ქ." },
    { en: "Chonkadze St", ka: "ჭონქაძის ქ." },
  ],
  Saburtalo: [
    { en: "Vazha-Pshavela Ave", ka: "ვაჟა-ფშაველას გამზ." },
    { en: "Nutsubidze St", ka: "ნუცუბიძის ქ." },
    { en: "Kazbegi Ave", ka: "ყაზბეგის გამზ." },
  ],
  Mtatsminda: [
    { en: "Betlemi St", ka: "ბეთლემის ქ." },
    { en: "Makashvili St", ka: "მაყაშვილის ქ." },
    { en: "Asatiani St", ka: "ასათიანის ქ." },
  ],
  Sololaki: [
    { en: "Leonidze St", ka: "ლეონიძის ქ." },
    { en: "Gudiashvili Sq", ka: "გუდიაშვილის მოედ." },
    { en: "Dadiani St", ka: "დადიანის ქ." },
  ],
  Gldani: [
    { en: "Khizanishvili St", ka: "ხიზანიშვილის ქ." },
    { en: "Omar Khachidze St", ka: "ომარ ხაჩიძის ქ." },
    { en: "Kerchi St", ka: "კერჩის ქ." },
  ],
  "Didi Digomi": [
    { en: "Petre Kavtaradze St", ka: "პეტრე ქავთარაძის ქ." },
    { en: "Digomi Massive", ka: "დიღმის მასივი" },
    { en: "Tashkenti St", ka: "ტაშკენტის ქ." },
  ],
  Isani: [
    { en: "Ketevan Tsamebuli Ave", ka: "ქეთევან წამებულის გამზ." },
    { en: "Navtlughi St", ka: "ნავთლუღის ქ." },
    { en: "Moscow Ave", ka: "მოსკოვის გამზ." },
  ],
};

// District price multipliers — Vake/Vera command a premium, Gldani/Isani less.
const DISTRICT_PRICE_FACTOR: Record<District, number> = {
  Vake: 1.35,
  Vera: 1.25,
  Mtatsminda: 1.2,
  Sololaki: 1.15,
  Saburtalo: 1.0,
  "Didi Digomi": 0.85,
  Isani: 0.8,
  Gldani: 0.72,
};

const PHOTO_POOL = [
  "https://picsum.photos/seed/tbilisi-a/640/480",
  "https://picsum.photos/seed/tbilisi-b/640/480",
  "https://picsum.photos/seed/tbilisi-c/640/480",
  "https://picsum.photos/seed/tbilisi-d/640/480",
  "https://picsum.photos/seed/tbilisi-e/640/480",
];

const HEATING_KA: Record<HeatingType, string> = {
  central: "ცენტ. გათბობა",
  gas: "გაზის გათბობა",
  electric: "ელ. გათბობა",
  none: "გათბობის გარეშე",
};

const PROPERTY_KA: Record<PropertyType, string> = {
  apartment: "ბინა",
  house: "სახლი",
  studio: "სტუდიო",
  room: "ოთახი",
};

function describeEn(l: SourceListing, street: string): string {
  const parts: string[] = [];
  parts.push(
    `${l.rooms ?? "?"}-room ${l.propertyType} on ${street}, ${l.district}.`,
  );
  if (l.areaSqm) parts.push(`${l.areaSqm} m².`);
  parts.push(l.furnished ? "Fully furnished." : "Unfurnished.");
  if (l.heating) parts.push(`${l.heating} heating.`);
  parts.push(l.petsAllowed ? "Pets welcome." : "No pets.");
  parts.push(`${l.currency === "USD" ? "$" : ""}${l.price}/month.`);
  return parts.join(" ");
}

function describeKa(
  l: SourceListing,
  streetKa: string,
  districtKa: string,
): string {
  const parts: string[] = [];
  parts.push(
    `${l.rooms ?? "?"}-ოთახიანი ${PROPERTY_KA[l.propertyType]} ${streetKa}-ზე, ${districtKa}.`,
  );
  if (l.areaSqm) parts.push(`${l.areaSqm} მ².`);
  parts.push(l.furnished ? "სრული ავეჯით." : "ავეჯის გარეშე.");
  if (l.heating) parts.push(`${HEATING_KA[l.heating]}.`);
  parts.push(l.petsAllowed ? "ცხოველები დაშვებულია." : "ცხოველების გარეშე.");
  parts.push(`${l.price}$/თვე.`);
  return parts.join(" ");
}

export interface MockSourceOptions {
  /** How many listings to generate. */
  count?: number;
  /** Deterministic seed — same seed ⇒ same listings. */
  seed?: number;
  /** Reference "now"; dates are generated relative to this. */
  now?: Date;
  /**
   * Fraction of listings that are intentionally stale (lastSeenAt well in the
   * past) so staleness filtering has something to exclude.
   */
  staleFraction?: number;
  /**
   * Fraction of listings that are intentionally near-duplicates of an earlier
   * one (same district/address/price/area) so de-duplication has work to do.
   */
  duplicateFraction?: number;
}

/**
 * The only ingestion adapter in the MVP. Generates realistic, reproducible mock
 * Tbilisi rentals. Real portals get added later behind the same ListingSource
 * interface without touching downstream code.
 */
export class MockSource implements ListingSource {
  readonly key = "mock";

  constructor(private readonly opts: MockSourceOptions = {}) {}

  async fetchListings(): Promise<SourceListing[]> {
    return this.generate();
  }

  generate(): SourceListing[] {
    const {
      count = 80,
      seed = 1337,
      now = new Date(),
      staleFraction = 0.12,
      duplicateFraction = 0.1,
    } = this.opts;

    const rng = new Rng(seed);
    const listings: SourceListing[] = [];

    for (let i = 0; i < count; i++) {
      // Occasionally clone a previous listing into a near-duplicate.
      if (i > 0 && rng.bool(duplicateFraction)) {
        const base = listings[rng.int(0, listings.length - 1)]!;
        listings.push(this.makeDuplicate(base, i, rng, now));
        continue;
      }
      listings.push(this.makeOne(i, rng, now, staleFraction));
    }

    return listings;
  }

  private makeOne(
    index: number,
    rng: Rng,
    now: Date,
    staleFraction: number,
  ): SourceListing {
    const district = rng.pick(DISTRICTS);
    const street = rng.pick(STREETS[district]);
    const propertyType = rng.pick(PROPERTY_TYPES);

    const rooms =
      propertyType === "studio" ? 1 : propertyType === "room" ? 1 : rng.int(1, 4);
    const bedrooms = Math.max(1, rooms - 1);
    const areaSqm =
      propertyType === "room"
        ? rng.int(12, 22)
        : propertyType === "studio"
          ? rng.int(24, 42)
          : rng.int(38, 140);

    const base = rng.int(300, 2000);
    const price = Math.round(
      Math.min(2000, Math.max(300, base * DISTRICT_PRICE_FACTOR[district])) / 10,
    ) * 10;

    const furnished = rng.bool(0.62);
    const heating = rng.pick(HEATING_TYPES);
    const petsAllowed = rng.bool(0.4);
    const floor = rng.int(1, 16);

    const postedDaysAgo = rng.int(1, 60);
    const postedAt = new Date(now.getTime() - postedDaysAgo * DAY_MS);

    const isStale = rng.bool(staleFraction);
    const lastSeenDaysAgo = isStale
      ? rng.int(25, 70) // beyond the default 21-day staleness window
      : rng.int(0, 6);
    const lastSeenAt = new Date(now.getTime() - lastSeenDaysAgo * DAY_MS);

    // Availability: some now, some a few months out.
    const availOffsetDays = rng.pick([-30, -10, 0, 15, 45, 75, 110]);
    const availableFrom = new Date(now.getTime() + availOffsetDays * DAY_MS);

    const externalId = `mock-${String(index).padStart(4, "0")}`;
    const photos = [rng.pick(PHOTO_POOL), rng.pick(PHOTO_POOL)];

    const listing: SourceListing = {
      externalId,
      source: this.key,
      sourceUrl: `https://mock.listings.local/l/${externalId}`,
      type: "rent",
      propertyType,
      district,
      addressApprox: `${street.en}, ${district}`,
      price,
      currency: "USD",
      areaSqm,
      rooms,
      bedrooms,
      floor,
      furnished,
      heating,
      petsAllowed,
      availableFrom,
      postedAt,
      lastSeenAt,
      photos,
    };

    listing.rawText = describeEn(listing, street.en);
    listing.rawTextKa = describeKa(listing, street.ka, DISTRICT_KA[district]);
    return listing;
  }

  private makeDuplicate(
    base: SourceListing,
    index: number,
    rng: Rng,
    now: Date,
  ): SourceListing {
    const externalId = `mock-${String(index).padStart(4, "0")}`;
    // Fresher re-post of the same unit, jittered slightly on price/area.
    const lastSeenDaysAgo = rng.int(0, 3);
    const dup: SourceListing = {
      ...base,
      externalId,
      sourceUrl: `https://mock.listings.local/l/${externalId}`,
      price: base.price + rng.pick([-20, 0, 0, 10]),
      areaSqm: base.areaSqm ? base.areaSqm + rng.pick([-1, 0, 1]) : undefined,
      postedAt: new Date(now.getTime() - rng.int(0, 5) * DAY_MS),
      lastSeenAt: new Date(now.getTime() - lastSeenDaysAgo * DAY_MS),
      photos: [...base.photos],
    };
    return dup;
  }
}
