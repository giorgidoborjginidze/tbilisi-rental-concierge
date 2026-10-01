import { describe, expect, it } from "vitest";
import { aggregateListings, parseFigureLines, parseListings, splitCsvLine } from "./parse";

const rates = { USD: 2.7, EUR: 3 };

describe("market data input", () => {
  it("reads report lines in either language and flags bad ones", () => {
    const { figures, badLines } = parseFigureLines("ვაკე, ქირა, 32\nSaburtalo; sale_sqm; 3300; 120\nVera, occupancy, 68%\n# note\nნონსენსი, x, 1");
    expect(figures).toEqual([
      { district: "Vake", metric: "rent_sqm", value: 32, sampleSize: 0 },
      { district: "Saburtalo", metric: "sale_sqm", value: 3300, sampleSize: 120 },
      { district: "Vera", metric: "occupancy", value: 0.68, sampleSize: 0 },
    ]);
    expect(badLines).toEqual([5]);
  });

  it("reads a listings export and keeps only district aggregates", () => {
    const csv = [
      'district;type;price;currency;area;phone',
      ...Array.from({ length: 6 }, (_, i) => `ვაკე;ქირა;${1500 + i * 10};GEL;50;555000`),
      ...Array.from({ length: 5 }, () => `Vake;იყიდება;"120,000";USD;80;555`),
      'Vake;rent;9;GEL;3;x',
    ].join("\n");
    const { listings, skipped } = parseListings(csv, rates);
    expect(skipped).toBe(1);
    const figures = aggregateListings(listings);
    expect(figures.find((f) => f.metric === "rent_sqm")).toMatchObject({ district: "Vake", sampleSize: 6 });
    expect(figures.find((f) => f.metric === "sale_sqm")!.value).toBeCloseTo((120000 * 2.7) / 80, 0);
  });

  it("says which columns are missing and respects quotes", () => {
    expect(parseListings("a,b\n1,2", rates).missing).toEqual(["district", "type", "price", "area"]);
    expect(splitCsvLine('"a, b",c,"d ""e"""', ",")).toEqual(["a, b", "c", 'd "e"']);
  });
});
