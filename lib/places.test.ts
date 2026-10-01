import { describe, expect, it } from "vitest";
import { cityKey, cityLabel, districtKey, districtLabel, districtOptions, isKnownDistrict } from "./places";
import { KNOWN_DISTRICTS, CITIES } from "./types";

describe("districtKey", () => {
  it("resolves Georgian names, case endings and English spellings to the benchmark key", () => {
    expect(districtKey("ვაკე")).toBe("Vake");
    expect(districtKey("  ვაკეში ")).toBe("Vake");
    expect(districtKey("საბურთალო")).toBe("Saburtalo");
    expect(districtKey("ძველი თბილისი")).toBe("Old Town");
    expect(districtKey("old tbilisi")).toBe("Old Town");
    expect(districtKey("OLD  TOWN")).toBe("Old Town");
    expect(districtKey("vake")).toBe("Vake");
    expect(districtKey("ბათუმის ბულვარი")).toBe("Batumi Boulevard");
  });

  it("keeps an unknown district as typed, and empty as null", () => {
    expect(districtKey(" კოჯორი ")).toBe("კოჯორი");
    expect(isKnownDistrict("კოჯორი")).toBe(false);
    expect(districtKey("დიდუბეში")).toBe("Didube");
    expect(isKnownDistrict("ვერა")).toBe(true);
    expect(districtKey("")).toBeNull();
    expect(districtKey(null)).toBeNull();
  });

  it("covers every known district and city (every key has a Georgian name)", () => {
    for (const key of KNOWN_DISTRICTS) {
      expect(districtKey(key)).toBe(key);
      expect(districtLabel("ka", key)).not.toBe(key);
    }
    for (const key of CITIES) expect(cityLabel("ka", key)).not.toBe(key);
  });
});

describe("labels", () => {
  it("shows the stored key in the reader's language", () => {
    expect(districtLabel("ka", "Vake")).toBe("ვაკე");
    expect(districtLabel("en", "ვაკე")).toBe("Vake");
    expect(districtLabel("ka", "Old Town")).toBe("ძველი თბილისი");
    expect(districtLabel("ka", "დიდუბე")).toBe("დიდუბე");
    expect(cityLabel("ka", "Tbilisi")).toBe("თბილისი");
    expect(cityKey("ბათუმი")).toBe("Batumi");
    expect(districtOptions("ka")).toContain("საბურთალო");
  });
});

import { suggestRate } from "./pricing/engine";

describe("pricing by canonical place", () => {
  it("a city typed in Georgian gets the same seasonality as its key", () => {
    const base = { baseNightlyRate: 150, date: new Date("2026-07-15T00:00:00Z"), upcomingOccupancy: 0.5 };
    expect(suggestRate({ ...base, city: "ბათუმი" })).toEqual(suggestRate({ ...base, city: "Batumi" }));
    // …and Batumi's July is not Tbilisi's.
    expect(suggestRate({ ...base, city: "ბათუმი" })).not.toEqual(suggestRate({ ...base, city: "Tbilisi" }));
  });
});
