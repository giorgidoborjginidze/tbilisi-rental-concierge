import { describe, expect, it } from "vitest";
import { monthRange, pageFromQuery, pageSlices } from "./list";

describe("pageSlices", () => {
  it("takes the first list, then continues into the second", () => {
    expect(pageSlices(0, 30, 100)).toEqual({ first: { skip: 0, take: 30 }, second: { skip: 0, take: 70 } });
    expect(pageSlices(0, 250, 100)).toEqual({ first: { skip: 0, take: 100 }, second: { skip: 0, take: 0 } });
    expect(pageSlices(2, 250, 100)).toEqual({ first: { skip: 200, take: 50 }, second: { skip: 0, take: 50 } });
    expect(pageSlices(3, 250, 100)).toEqual({ first: { skip: 250, take: 0 }, second: { skip: 50, take: 100 } });
  });
});

describe("pageFromQuery", () => {
  it("reads a 1-based page and clamps it to the last one", () => {
    expect(pageFromQuery(undefined, 450)).toBe(0);
    expect(pageFromQuery("2", 450)).toBe(1);
    expect(pageFromQuery("99", 450)).toBe(4);
    expect(pageFromQuery("-3", 450)).toBe(0);
    expect(pageFromQuery("x", 0)).toBe(0);
  });
});

describe("monthRange", () => {
  it("parses YYYY-MM", () => {
    expect(monthRange("2026-07")).toEqual({
      start: new Date("2026-07-01T00:00:00Z"),
      end: new Date("2026-08-01T00:00:00Z"),
    });
    expect(monthRange("2026-12")?.end).toEqual(new Date("2027-01-01T00:00:00Z"));
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange(undefined)).toBeNull();
  });
});
