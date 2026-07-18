import { parseCriteria, type SearchCriteria } from "../criteria";
import {
  DISTRICTS,
  DISTRICT_KA,
  normalizeDistrict,
  type District,
  type HeatingType,
  type PropertyType,
} from "../domain";
import type { MatchableListing, MatchReason } from "../matching/types";

// Deterministic, dependency-free NL → criteria extraction and match-explanation.
// This is the fallback used when no ANTHROPIC_API_KEY is configured (and the
// safety net when an AI call fails). It is intentionally simple but handles the
// common English + Georgian phrasings the intake box will see.

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  studio: 1,
  ერთი: 1, ორ: 2, ორი: 2, სამ: 3, სამი: 3, ოთხ: 4, ოთხი: 4,
};

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  // Georgian month stems
  იანვ: 0, თებერ: 1, მარ: 2, აპრ: 3, მაის: 4, ივნ: 5,
  ივლ: 6, აგვ: 7, სექტემბ: 8, ოქტომბ: 9, ნოემბ: 10, დეკემბ: 11,
};

function wordToNumber(token: string): number | undefined {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return NUMBER_WORDS[token];
}

function firstOfMonth(monthIndex: number, now: Date): string {
  const year =
    monthIndex >= now.getMonth() ? now.getFullYear() : now.getFullYear() + 1;
  const d = new Date(year, monthIndex, 1);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-01`;
}

export function stubExtractCriteria(
  rawQuery: string,
  now: Date = new Date(),
): SearchCriteria {
  const text = ` ${rawQuery.toLowerCase()} `;
  const draft: Record<string, unknown> = { type: "rent", currency: "USD" };

  // --- type ---
  if (/\b(buy|purchase|for sale)\b/.test(text) || text.includes("იყიდება")) {
    draft.type = "sale";
  }

  // --- price ceiling ---
  // "$800", "800$", "under 800", "800 usd/gel/lari", "800-მდე"
  const priceMatches = [
    ...text.matchAll(
      /(?:under|below|max|up to|less than|≤|<|budget of|around)\s*\$?\s*(\d{3,5})/g,
    ),
    ...text.matchAll(/\$\s*(\d{3,5})/g),
    ...text.matchAll(/(\d{3,5})\s*(?:\$|usd|gel|lari|₾|დოლ|ლარ|-მდე)/g),
  ];
  const prices = priceMatches
    .map((m) => parseInt(m[1]!, 10))
    .filter((n) => n >= 100 && n <= 100000);
  if (prices.length > 0) draft.maxPrice = Math.max(...prices);

  // --- bedrooms / rooms ---
  const bedMatch = text.match(
    /(\d+|one|two|three|four|five|ერთი?|ორი?|სამი?|ოთხი?)[\s-]*(?:bed(?:room)?s?|საძინებ)/,
  );
  if (bedMatch) {
    const n = wordToNumber(bedMatch[1]!.trim());
    if (n) draft.minBedrooms = n;
  }
  const roomMatch = text.match(
    /(\d+|one|two|three|four|five|ერთი?|ორი?|სამი?|ოთხი?)[\s-]*(?:room|ოთახ)/,
  );
  if (roomMatch && !/bed|საძინებ/.test(roomMatch[0])) {
    const n = wordToNumber(roomMatch[1]!.trim());
    if (n) draft.minRooms = n;
  }

  // --- property types ---
  const propertyTypes: PropertyType[] = [];
  if (/\bstudio\b/.test(text) || text.includes("სტუდიო")) propertyTypes.push("studio");
  if (/\bhouse\b/.test(text) || text.includes("სახლ")) propertyTypes.push("house");
  if (/\b(flat|apartment)\b/.test(text) || text.includes("ბინა")) {
    propertyTypes.push("apartment");
  }
  if (/\b(single )?room\b/.test(text)) propertyTypes.push("room");
  if (propertyTypes.length) draft.propertyTypes = [...new Set(propertyTypes)];

  // --- districts ---
  const districts = new Set<District>();
  const haystacks = [text, ` ${rawQuery} `];
  for (const d of DISTRICTS) {
    const en = d.toLowerCase();
    if (text.includes(en) || haystacks.some((h) => h.includes(DISTRICT_KA[d]))) {
      districts.add(d);
    }
  }
  // aliases (old town, digomi, ...)
  for (const alias of ["old town", "digomi", "sololaki"]) {
    if (text.includes(alias)) {
      const n = normalizeDistrict(alias);
      if (n) districts.add(n);
    }
  }
  if (districts.size) draft.districts = [...districts];

  // --- furnished ---
  if (/\bunfurnished\b/.test(text) || text.includes("ავეჯის გარეშე")) {
    draft.furnished = false;
  } else if (/\bfurnish(ed)?\b/.test(text) || text.includes("ავეჯ")) {
    draft.furnished = true;
  }

  // --- pets ---
  if (/\bno pets?\b/.test(text) || text.includes("ცხოველების გარეშე")) {
    draft.petsAllowed = false;
  } else if (
    /\b(pet[-\s]?friendly|pets? (?:ok|allowed|welcome)|with pets?)\b/.test(text) ||
    text.includes("ცხოველ")
  ) {
    draft.petsAllowed = true;
  }

  // --- heating ---
  const heating: HeatingType | undefined = /\bcentral\b/.test(text) || text.includes("ცენტრალ")
    ? "central"
    : /\bgas\b/.test(text) || text.includes("გაზ")
      ? "gas"
      : /\belectric\b/.test(text) || text.includes("ელექტრო")
        ? "electric"
        : undefined;
  if (heating) draft.heating = heating;

  // --- availability ---
  if (/\b(now|immediately|asap)\b/.test(text) || text.includes("ახლავე")) {
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    draft.availableFrom = `${now.getFullYear()}-${mm}-${dd}`;
  } else {
    for (const [name, idx] of Object.entries(MONTHS)) {
      if (text.includes(name)) {
        draft.availableFrom = firstOfMonth(idx, now);
        break;
      }
    }
  }

  // --- min area ---
  const areaMatch = text.match(/(\d{2,4})\s*(?:m2|m²|sqm|sq m|კვ\.?\s?მ|მ²)/);
  if (areaMatch) draft.minAreaSqm = parseInt(areaMatch[1]!, 10);

  const parsed = parseCriteria(draft);
  // The draft is built from our own controlled vocabulary, so validation should
  // pass; if a stray value slips through, fall back to a minimal safe criteria.
  return parsed.success ? parsed.data : { type: "rent", currency: "USD" };
}

/** Deterministic one-line explanation, assembled from the top match reasons. */
export function stubExplainMatch(
  listing: MatchableListing,
  reasons: MatchReason[],
  language: "en" | "ka" = "en",
): string {
  const top = reasons.slice(0, 3).map((r) => r.label.toLowerCase());
  if (language === "ka") {
    const bits: string[] = [];
    if (listing.district) bits.push(`${DISTRICT_KA[listing.district as District] ?? listing.district}`);
    bits.push(`$${listing.price}/თვე`);
    if (listing.furnished) bits.push("ავეჯით");
    return `${listing.rooms ?? ""}-ოთახიანი ${bits.join(", ")}.`;
  }
  if (top.length === 0) {
    return `${listing.propertyType} in ${listing.district} at $${listing.price}/mo.`;
  }
  return `Matches on ${top.join(", ")} — $${listing.price}/mo in ${listing.district}.`;
}
