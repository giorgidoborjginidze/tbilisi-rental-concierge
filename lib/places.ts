// Cities and districts: one canonical key per place, names in both
// languages, and the ways owners actually type them — pure, client-safe.
//
// The key ("Vake", "Old Town", "Tbilisi") is what is stored and what the
// market benchmarks are keyed by (RentBenchmark, MarketBenchmark). Owners
// type "ვაკე" or "ძველი თბილისი"; those resolve to the same key, so the
// market-rent comparison and the pricing advice work whichever language
// the district was written in. A place we do not know is kept as typed.

import type { Locale } from "@/lib/i18n/strings";

interface Place {
  en: string;
  ka: string;
  /** Other spellings, any case (Georgian case endings included). */
  aliases: string[];
}

export const CITY_PLACES: Record<string, Place> = {
  Tbilisi: { en: "Tbilisi", ka: "თბილისი", aliases: ["tiflis", "თბილისში", "თბილისის"] },
  Batumi: { en: "Batumi", ka: "ბათუმი", aliases: ["ბათუმში", "ბათუმის"] },
};

export const DISTRICT_PLACES: Record<string, Place> = {
  Vake: { en: "Vake", ka: "ვაკე", aliases: ["vake district", "ვაკის", "ვაკეში", "ვაკის რაიონი"] },
  Vera: { en: "Vera", ka: "ვერა", aliases: ["veri", "ვერის", "ვერაზე"] },
  Saburtalo: {
    en: "Saburtalo",
    ka: "საბურთალო",
    aliases: ["saburtalo district", "საბურთალოს", "საბურთალოზე", "საბურთალოს რაიონი"],
  },
  "Old Town": {
    en: "Old Town",
    ka: "ძველი თბილისი",
    aliases: ["old tbilisi", "oldtown", "old city", "ძველი ქალაქი", "ძველ თბილისში", "ძველი უბანი"],
  },
  Mtatsminda: { en: "Mtatsminda", ka: "მთაწმინდა", aliases: ["მთაწმინდის", "მთაწმინდაზე"] },
  "Batumi Boulevard": {
    en: "Batumi Boulevard",
    ka: "ბათუმის ბულვარი",
    aliases: ["boulevard", "batumi blvd", "ბულვარი", "ბულვართან", "ბათუმის ბულვართან"],
  },
};

/** Lower case, one space, no surrounding punctuation. */
const normalise = (value: string) =>
  value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,;:!?"'«»„“”()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function indexOf(places: Record<string, Place>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [key, place] of Object.entries(places)) {
    for (const name of [key, place.en, place.ka, ...place.aliases]) index.set(normalise(name), key);
  }
  return index;
}

const CITY_INDEX = indexOf(CITY_PLACES);
const DISTRICT_INDEX = indexOf(DISTRICT_PLACES);

function keyOf(index: Map<string, string>, value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return index.get(normalise(trimmed)) ?? trimmed;
}

/**
 * The stored/benchmark key of a district as typed ("ვაკე" → "Vake");
 * a district we do not know comes back as typed (trimmed); empty → null.
 */
export const districtKey = (value: string | null | undefined) => keyOf(DISTRICT_INDEX, value);

/** The stored key of a city as typed ("თბილისი" → "Tbilisi"). */
export const cityKey = (value: string | null | undefined) => keyOf(CITY_INDEX, value);

/** Is this a district the market benchmarks know? */
export const isKnownDistrict = (value: string | null | undefined) => {
  const key = districtKey(value);
  return key != null && key in DISTRICT_PLACES;
};

function labelOf(places: Record<string, Place>, index: Map<string, string>, locale: Locale, value: string | null | undefined) {
  const key = keyOf(index, value);
  if (!key) return "";
  const place = places[key];
  return place ? place[locale] : key;
}

/** A district in the reader's language ("Vake" → "ვაკე" in ka). */
export const districtLabel = (locale: Locale, value: string | null | undefined) =>
  labelOf(DISTRICT_PLACES, DISTRICT_INDEX, locale, value);

/** A city in the reader's language ("Tbilisi" → "თბილისი" in ka). */
export const cityLabel = (locale: Locale, value: string | null | undefined) =>
  labelOf(CITY_PLACES, CITY_INDEX, locale, value);

/** The names a district field suggests, in the reader's language. */
export const districtOptions = (locale: Locale) => Object.values(DISTRICT_PLACES).map((place) => place[locale]);

/** The names a city field suggests, in the reader's language. */
export const cityOptions = (locale: Locale) => Object.values(CITY_PLACES).map((place) => place[locale]);
