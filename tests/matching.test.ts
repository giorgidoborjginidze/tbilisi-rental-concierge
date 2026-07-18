import { describe, expect, it } from "vitest";
import type { SearchCriteria } from "@/lib/criteria";
import {
  dedupeKey,
  dedupeListings,
  districtScore,
  passesHardGates,
  runMatching,
  type MatchableListing,
} from "@/lib/matching";

// Fixed reference clock so tests are deterministic.
const NOW = new Date("2026-07-15T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * DAY_MS);

let seq = 0;
function listing(overrides: Partial<MatchableListing> = {}): MatchableListing {
  seq += 1;
  return {
    id: `l-${seq}`,
    type: "rent",
    propertyType: "apartment",
    district: "Vake",
    addressApprox: "Chavchavadze Ave, Vake",
    price: 700,
    currency: "USD",
    areaSqm: 70,
    rooms: 3,
    bedrooms: 2,
    floor: 4,
    furnished: true,
    heating: "central",
    petsAllowed: true,
    availableFrom: null,
    postedAt: daysAgo(5),
    lastSeenAt: daysAgo(1),
    isActive: true,
    ...overrides,
  };
}

const baseCriteria: SearchCriteria = { type: "rent", currency: "USD" };

describe("hard gates", () => {
  it("rejects sale listings when renting", () => {
    const result = passesHardGates(baseCriteria, listing({ type: "sale" }), NOW);
    expect(result).toEqual({ passed: false, failedGate: "type" });
  });

  it("rejects inactive listings", () => {
    const result = passesHardGates(baseCriteria, listing({ isActive: false }), NOW);
    expect(result.failedGate).toBe("inactive");
  });

  it("enforces the price ceiling", () => {
    const criteria = { ...baseCriteria, maxPrice: 800 };
    expect(passesHardGates(criteria, listing({ price: 800 }), NOW).passed).toBe(true);
    expect(passesHardGates(criteria, listing({ price: 801 }), NOW).failedGate).toBe(
      "maxPrice",
    );
  });

  it("enforces the price floor when given", () => {
    const criteria = { ...baseCriteria, minPrice: 500 };
    expect(passesHardGates(criteria, listing({ price: 499 }), NOW).failedGate).toBe(
      "minPrice",
    );
  });

  it("treats minBedrooms as a minimum", () => {
    const criteria = { ...baseCriteria, minBedrooms: 2 };
    expect(passesHardGates(criteria, listing({ bedrooms: 2 }), NOW).passed).toBe(true);
    expect(passesHardGates(criteria, listing({ bedrooms: 3 }), NOW).passed).toBe(true);
    expect(
      passesHardGates(criteria, listing({ bedrooms: 1 }), NOW).failedGate,
    ).toBe("minBedrooms");
    expect(
      passesHardGates(criteria, listing({ bedrooms: null }), NOW).failedGate,
    ).toBe("minBedrooms");
  });

  it("treats exactRooms as exact and overriding minRooms", () => {
    const criteria = { ...baseCriteria, exactRooms: 2, minRooms: 1 };
    expect(passesHardGates(criteria, listing({ rooms: 2 }), NOW).passed).toBe(true);
    expect(passesHardGates(criteria, listing({ rooms: 3 }), NOW).failedGate).toBe(
      "exactRooms",
    );
  });

  it("gates on the requested district set", () => {
    const criteria: SearchCriteria = {
      ...baseCriteria,
      districts: ["Vera", "Vake"],
    };
    expect(passesHardGates(criteria, listing({ district: "Vake" }), NOW).passed).toBe(
      true,
    );
    expect(
      passesHardGates(criteria, listing({ district: "Gldani" }), NOW).failedGate,
    ).toBe("district");
  });

  it("passes any district when none requested", () => {
    expect(
      passesHardGates(baseCriteria, listing({ district: "Gldani" }), NOW).passed,
    ).toBe(true);
  });

  it("requires availability on or before the requested date", () => {
    const criteria = { ...baseCriteria, availableFrom: "2026-09-01" };
    // Available now (null) — passes.
    expect(
      passesHardGates(criteria, listing({ availableFrom: null }), NOW).passed,
    ).toBe(true);
    // Available before the requested date — passes.
    expect(
      passesHardGates(
        criteria,
        listing({ availableFrom: new Date("2026-08-15") }),
        NOW,
      ).passed,
    ).toBe(true);
    // Only available after — fails.
    expect(
      passesHardGates(
        criteria,
        listing({ availableFrom: new Date("2026-09-02") }),
        NOW,
      ).failedGate,
    ).toBe("availableFrom");
  });

  it("gates property type and minimum area when specified", () => {
    const criteria: SearchCriteria = {
      ...baseCriteria,
      propertyTypes: ["studio"],
      minAreaSqm: 30,
    };
    expect(
      passesHardGates(
        criteria,
        listing({ propertyType: "studio", areaSqm: 35 }),
        NOW,
      ).passed,
    ).toBe(true);
    expect(
      passesHardGates(criteria, listing({ propertyType: "apartment" }), NOW)
        .failedGate,
    ).toBe("propertyType");
    expect(
      passesHardGates(
        criteria,
        listing({ propertyType: "studio", areaSqm: 25 }),
        NOW,
      ).failedGate,
    ).toBe("minAreaSqm");
  });
});

describe("soft scoring", () => {
  const opts = { now: NOW };

  it("scores a perfect match near 1 and ranks it first", () => {
    const criteria: SearchCriteria = {
      ...baseCriteria,
      districts: ["Vake"],
      maxPrice: 1400,
      furnished: true,
      petsAllowed: true,
      heating: "central",
    };
    const perfect = listing({ price: 600, lastSeenAt: daysAgo(0) });
    const mediocre = listing({
      price: 1390,
      furnished: false,
      petsAllowed: false,
      heating: "none",
      lastSeenAt: daysAgo(20),
    });
    const result = runMatching(criteria, [mediocre, perfect], opts);
    expect(result.scored[0]!.listing.id).toBe(perfect.id);
    expect(result.scored[0]!.score).toBeGreaterThan(0.8);
  });

  it("gives cheaper-within-budget listings a higher score (price headroom)", () => {
    const criteria = { ...baseCriteria, maxPrice: 1000 };
    const cheap = listing({ price: 500 });
    const nearMax = listing({ price: 990 });
    const result = runMatching(criteria, [nearMax, cheap], opts);
    const scoreOf = (id: string) =>
      result.scored.find((s) => s.listing.id === id)!.score;
    expect(scoreOf(cheap.id)).toBeGreaterThan(scoreOf(nearMax.id));
  });

  it("gives fresher listings a higher score (recency)", () => {
    const fresh = listing({ lastSeenAt: daysAgo(0) });
    const older = listing({
      lastSeenAt: daysAgo(15),
      // different address so dedupe doesn't collapse them
      addressApprox: "Abashidze St, Vake",
    });
    const result = runMatching(baseCriteria, [older, fresh], {
      ...opts,
      scoreThreshold: 0,
    });
    const scoreOf = (id: string) =>
      result.scored.find((s) => s.listing.id === id)!.score;
    expect(scoreOf(fresh.id)).toBeGreaterThan(scoreOf(older.id));
  });

  it("credits adjacent districts partially (proximity)", () => {
    const criteria: SearchCriteria = { ...baseCriteria, districts: ["Vake"] };
    // District is a hard gate when requested — verify via the scoring fn only.
    const inVake = listing({ district: "Vake" });
    const adjacentVera = listing({ district: "Vera" });
    const farGldani = listing({ district: "Gldani" });
    expect(districtScore(criteria, inVake)).toBe(1);
    expect(districtScore(criteria, adjacentVera)).toBe(0.5);
    expect(districtScore(criteria, farGldani)).toBe(0);
  });

  it("only surfaces reasons for signals that contributed", () => {
    const criteria: SearchCriteria = {
      ...baseCriteria,
      furnished: true,
      petsAllowed: true,
    };
    const l = listing({ furnished: true, petsAllowed: false });
    const result = runMatching(criteria, [l], { ...opts, scoreThreshold: 0 });
    const keys = result.scored[0]!.reasons.map((r) => r.key);
    expect(keys).toContain("furnished");
    expect(keys).not.toContain("pets");
  });
});

describe("deduplication", () => {
  it("collapses near-duplicates and keeps the freshest", () => {
    const original = listing({ price: 700, areaSqm: 70, lastSeenAt: daysAgo(5) });
    const repost = listing({
      price: 710, // within the ±$25 bucket
      areaSqm: 71,
      lastSeenAt: daysAgo(0),
      addressApprox: original.addressApprox,
    });
    const different = listing({
      addressApprox: "Paliashvili St, Vake",
      price: 700,
      areaSqm: 70,
    });

    const deduped = dedupeListings([original, repost, different]);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((l) => l.id)).toContain(repost.id);
    expect(deduped.map((l) => l.id)).not.toContain(original.id);
    expect(deduped.map((l) => l.id)).toContain(different.id);
  });

  it("does not collapse listings with clearly different prices", () => {
    const a = listing({ price: 700 });
    const b = listing({ price: 1200, addressApprox: a.addressApprox });
    expect(dedupeKey(a)).not.toBe(dedupeKey(b));
    expect(dedupeListings([a, b])).toHaveLength(2);
  });
});

describe("staleness", () => {
  it("excludes listings older than the staleness window", () => {
    const fresh = listing({ lastSeenAt: daysAgo(2) });
    const stale = listing({
      lastSeenAt: daysAgo(30),
      addressApprox: "Abashidze St, Vake",
    });
    const result = runMatching(baseCriteria, [fresh, stale], {
      now: NOW,
      staleAfterDays: 21,
      scoreThreshold: 0,
    });
    expect(result.scored.map((s) => s.listing.id)).toEqual([fresh.id]);
    expect(result.stats.afterStaleness).toBe(1);
  });

  it("respects a custom staleness window", () => {
    const l = listing({ lastSeenAt: daysAgo(10) });
    const strict = runMatching(baseCriteria, [l], {
      now: NOW,
      staleAfterDays: 7,
      scoreThreshold: 0,
    });
    expect(strict.scored).toHaveLength(0);
    const lax = runMatching(baseCriteria, [l], {
      now: NOW,
      staleAfterDays: 14,
      scoreThreshold: 0,
    });
    expect(lax.scored).toHaveLength(1);
  });
});

describe("end-to-end pipeline", () => {
  it("reports pipeline stats and honours threshold + maxResults", () => {
    const criteria: SearchCriteria = {
      ...baseCriteria,
      maxPrice: 1000,
      furnished: true,
    };
    const listings = [
      listing({ price: 500, furnished: true }), // strong
      listing({ price: 950, furnished: false, addressApprox: "Abashidze St" }), // weak
      listing({ price: 2000 }), // gated out (price)
      listing({ lastSeenAt: daysAgo(40), addressApprox: "Kiacheli St" }), // stale
    ];
    const result = runMatching(criteria, listings, {
      now: NOW,
      scoreThreshold: 0.5,
      maxResults: 10,
    });
    expect(result.stats.total).toBe(4);
    expect(result.stats.afterStaleness).toBe(3);
    expect(result.stats.passedHardGates).toBe(2);
    expect(result.stats.returned).toBeLessThanOrEqual(2);
    // The strong candidate survives the 0.5 threshold; ranking is by score.
    expect(result.scored[0]!.listing.price).toBe(500);
  });

  it("caps results at maxResults", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      listing({ addressApprox: `Street ${i}, Vake`, price: 400 + i * 10 }),
    );
    const result = runMatching(baseCriteria, many, {
      now: NOW,
      scoreThreshold: 0,
      maxResults: 5,
    });
    expect(result.scored).toHaveLength(5);
  });
});
