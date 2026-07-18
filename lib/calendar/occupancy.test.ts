import { describe, expect, it } from "vitest";
import { findGaps, findOverlaps, mergeIntervals } from "./occupancy";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("mergeIntervals", () => {
  it("merges overlapping and back-to-back intervals", () => {
    const merged = mergeIntervals([
      { start: d("2026-08-01"), end: d("2026-08-05") },
      { start: d("2026-08-05"), end: d("2026-08-08") }, // back-to-back
      { start: d("2026-08-12"), end: d("2026-08-14") },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].end.toISOString()).toBe(d("2026-08-08").toISOString());
  });

  it("keeps the longer end when one stay swallows another", () => {
    const merged = mergeIntervals([
      { start: d("2026-08-01"), end: d("2026-08-10") },
      { start: d("2026-08-03"), end: d("2026-08-05") },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].end.toISOString()).toBe(d("2026-08-10").toISOString());
  });
});

describe("findGaps", () => {
  const window = { start: d("2026-08-01"), end: d("2026-09-01") };

  it("finds gaps before, between, and after stays", () => {
    const gaps = findGaps(
      [
        { start: d("2026-08-05"), end: d("2026-08-10") },
        { start: d("2026-08-15"), end: d("2026-08-20") },
      ],
      window,
    );
    expect(gaps).toEqual([
      { start: d("2026-08-01"), end: d("2026-08-05"), nights: 4 },
      { start: d("2026-08-10"), end: d("2026-08-15"), nights: 5 },
      { start: d("2026-08-20"), end: d("2026-09-01"), nights: 12 },
    ]);
  });

  it("returns the whole window when there are no stays", () => {
    const gaps = findGaps([], window);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].nights).toBe(31);
  });

  it("returns nothing when fully booked, and clips stays outside the window", () => {
    const gaps = findGaps(
      [{ start: d("2026-07-20"), end: d("2026-09-10") }],
      window,
    );
    expect(gaps).toHaveLength(0);
  });

  it("respects minNights", () => {
    const gaps = findGaps(
      [
        { start: d("2026-08-01"), end: d("2026-08-10") },
        { start: d("2026-08-11"), end: d("2026-09-01") }, // 1-night gap
      ],
      window,
      2,
    );
    expect(gaps).toHaveLength(0);
  });

  it("ignores back-to-back turnover days", () => {
    const gaps = findGaps(
      [
        { start: d("2026-08-01"), end: d("2026-08-10") },
        { start: d("2026-08-10"), end: d("2026-09-01") },
      ],
      window,
    );
    expect(gaps).toHaveLength(0);
  });
});

describe("findOverlaps", () => {
  it("reports the intersecting nights of a double-booking", () => {
    const overlaps = findOverlaps([
      { id: "a", kind: "airbnb", start: d("2026-08-01"), end: d("2026-08-06") },
      { id: "b", kind: "booking", start: d("2026-08-04"), end: d("2026-08-09") },
    ]);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]).toMatchObject({
      nights: 2,
      stayIds: ["a", "b"],
      kinds: ["airbnb", "booking"],
    });
    expect(overlaps[0].start.toISOString()).toBe(d("2026-08-04").toISOString());
  });

  it("treats back-to-back stays as no overlap", () => {
    expect(
      findOverlaps([
        { id: "a", kind: "airbnb", start: d("2026-08-01"), end: d("2026-08-05") },
        { id: "b", kind: "direct", start: d("2026-08-05"), end: d("2026-08-08") },
      ]),
    ).toHaveLength(0);
  });

  it("finds a booking colliding with a lease", () => {
    const overlaps = findOverlaps([
      { id: "lease1", kind: "lease", start: d("2026-03-01"), end: d("2026-08-15") },
      { id: "b1", kind: "airbnb", start: d("2026-08-10"), end: d("2026-08-18") },
    ]);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].nights).toBe(5);
  });

  it("reports all pairs among three overlapping stays", () => {
    const overlaps = findOverlaps([
      { id: "a", kind: "airbnb", start: d("2026-08-01"), end: d("2026-08-10") },
      { id: "b", kind: "booking", start: d("2026-08-02"), end: d("2026-08-08") },
      { id: "c", kind: "manual", start: d("2026-08-03"), end: d("2026-08-05") },
    ]);
    expect(overlaps).toHaveLength(3);
  });
});
