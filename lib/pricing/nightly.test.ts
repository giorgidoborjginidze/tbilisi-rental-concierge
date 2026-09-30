import { describe, expect, it } from "vitest";
import { benchmarkMonth, freeWindowRange, occupancyShare, windowPrice } from "./nightly";
import { suggestRate } from "./engine";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("occupancyShare", () => {
  it("counts each covered night once within the horizon", () => {
    const stays = [
      { start: d("2026-10-01"), end: d("2026-10-04") },
      { start: d("2026-10-03"), end: d("2026-10-05") }, // overlaps one night
      { start: d("2026-11-20"), end: d("2026-11-25") }, // beyond 30 days
    ];
    expect(occupancyShare(stays, d("2026-10-01"), 30)).toBeCloseTo(4 / 30);
  });
});

describe("windowPrice", () => {
  const unit = { baseNightlyRate: 150, city: "Tbilisi" };

  it("prices every night with the same engine as the pricing page and averages them", () => {
    const window = { start: d("2026-10-10"), end: d("2026-10-13") };
    const benchmarks = new Map([["2026-10", 180]]);
    const priced = windowPrice(unit, window, 0.4, benchmarks)!;
    expect(priced.nights).toHaveLength(3);
    const expected = suggestRate({
      baseNightlyRate: 150,
      city: "Tbilisi",
      date: d("2026-10-10"),
      upcomingOccupancy: 0.4,
      benchmarkAdr: 180,
    }).suggestedRate;
    expect(priced.nights[0].rate).toBe(expected);
    expect(priced.perNight).toBe(
      Math.round(priced.nights.reduce((sum, night) => sum + night.rate, 0) / 3),
    );
  });

  it("a window across two months uses each month's benchmark", () => {
    const window = { start: d("2026-10-31"), end: d("2026-11-02") };
    const priced = windowPrice(unit, window, 0.5, new Map([["2026-10", 300], ["2026-11", null]]))!;
    expect(benchmarkMonth(priced.nights[1].date)).toBe("2026-11");
    expect(priced.nights[0].rate).toBeGreaterThan(priced.nights[1].rate);
  });

  it("an empty window has no price", () => {
    expect(windowPrice(unit, { start: d("2026-10-10"), end: d("2026-10-10") }, 0, new Map())).toBeNull();
  });
});

describe("freeWindowRange", () => {
  const today = d("2026-09-30");
  it("on the current month: from today, the next 30 nights at least", () => {
    expect(freeWindowRange({ start: d("2026-09-01"), end: d("2026-10-01") }, today)).toEqual({
      start: today,
      end: d("2026-10-30"),
    });
  });
  it("a later month shows its own nights; a past month none", () => {
    const november = { start: d("2026-11-01"), end: d("2026-12-01") };
    expect(freeWindowRange(november, today)).toEqual(november);
    expect(freeWindowRange({ start: d("2026-08-01"), end: d("2026-09-01") }, today)).toBeNull();
  });
});
