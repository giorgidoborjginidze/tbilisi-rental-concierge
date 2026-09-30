import { describe, expect, it } from "vitest";
import { nightCells, OVERLAP_CODE, stripStart, stripStep, STRIP_DAYS } from "./cells";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("nightCells", () => {
  it("colours each night by the stay that holds it, a clash as overlap, daily answers only on free nights", () => {
    const stays = [
      { start: d("2026-10-02"), end: d("2026-10-04"), kind: "airbnb" },
      { start: d("2026-10-03"), end: d("2026-10-05"), kind: "booking" },
      { start: d("2026-10-06"), end: d("2026-10-07"), kind: "lease" },
    ];
    const fills = [
      { start: d("2026-10-01"), end: d("2026-10-02"), kind: "day" },
      { start: d("2026-10-06"), end: d("2026-10-07"), kind: "day" },
    ];
    const cells = nightCells(stays, fills, d("2026-10-01"), 8);
    expect(cells).toEqual([
      [3, 3], // Oct 1: daily answer (index after the three stays)
      [1, 0], // Oct 2: airbnb
      [OVERLAP_CODE, 0], // Oct 3: airbnb + booking
      [2, 1], // Oct 4: booking (airbnb checked out)
      [0, -1], // Oct 5: free
      [4, 2], // Oct 6: the lease, not the daily answer
      [0, -1],
      [0, -1],
    ]);
  });
});

describe("the phone's two-week strip", () => {
  it("opens on today when the range holds it, never running past the end", () => {
    expect(stripStart(59, 20, 14)).toBe(20);
    expect(stripStart(59, 55, 14)).toBe(59 - STRIP_DAYS);
    expect(stripStart(59, null, 14)).toBe(14);
    expect(stripStart(10, 3, 0)).toBe(0);
  });

  it("pages by two weeks and stops at the range's edges", () => {
    expect(stripStep(20, 59, 1)).toBe(34);
    expect(stripStep(40, 59, 1)).toBe(45);
    expect(stripStep(45, 59, 1)).toBeNull();
    expect(stripStep(20, 59, -1)).toBe(6);
    expect(stripStep(6, 59, -1)).toBe(0);
    expect(stripStep(0, 59, -1)).toBeNull();
  });
});
