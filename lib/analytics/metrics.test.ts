import { describe, expect, it } from "vitest";
import {
  aggregateMetrics,
  clippedNights,
  monthWindows,
  proratedRevenue,
  unitWindowMetrics,
} from "./metrics";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const AUG = { start: d("2026-08-01"), end: d("2026-09-01") }; // 31 nights

const booking = (
  checkIn: string,
  checkOut: string,
  amount: number | null,
) => ({
  checkIn: d(checkIn),
  checkOut: d(checkOut),
  nights: Math.round((d(checkOut).getTime() - d(checkIn).getTime()) / 86_400_000),
  amount,
});

describe("clippedNights / proratedRevenue", () => {
  it("counts only nights inside the window", () => {
    const stay = booking("2026-07-30", "2026-08-04", 500); // 5 nights, 3 in Aug
    expect(clippedNights(stay, AUG)).toBe(3);
    expect(proratedRevenue(stay, AUG)).toBe(300);
  });

  it("returns zero for a stay entirely outside the window", () => {
    const stay = booking("2026-07-01", "2026-07-05", 400);
    expect(clippedNights(stay, AUG)).toBe(0);
    expect(proratedRevenue(stay, AUG)).toBe(0);
  });

  it("treats missing amounts as zero revenue but real nights", () => {
    const stay = booking("2026-08-10", "2026-08-12", null);
    expect(clippedNights(stay, AUG)).toBe(2);
    expect(proratedRevenue(stay, AUG)).toBe(0);
  });
});

describe("unitWindowMetrics", () => {
  it("computes occupancy, ADR and RevPAR", () => {
    const metrics = unitWindowMetrics(
      [booking("2026-08-01", "2026-08-11", 1000)], // 10 nights, 100/night
      AUG,
    );
    expect(metrics.availableNights).toBe(31);
    expect(metrics.occupiedNights).toBe(10);
    expect(metrics.occupancyRate).toBeCloseTo(10 / 31);
    expect(metrics.adr).toBe(100);
    expect(metrics.revpar).toBeCloseTo(1000 / 31);
  });

  it("merges double-booked nights for occupancy but sums them for ADR basis", () => {
    const metrics = unitWindowMetrics(
      [
        booking("2026-08-01", "2026-08-05", 400), // 4 nights
        booking("2026-08-03", "2026-08-07", 400), // 4 nights, 2 overlap
      ],
      AUG,
    );
    expect(metrics.occupiedNights).toBe(6); // merged 1..7
    expect(metrics.bookedNights).toBe(8);
    expect(metrics.revenue).toBe(800);
    expect(metrics.adr).toBe(100);
  });

  it("returns null ADR/RevPAR when nothing is sold in an empty window", () => {
    const metrics = unitWindowMetrics([], {
      start: d("2026-08-01"),
      end: d("2026-08-01"),
    });
    expect(metrics.adr).toBeNull();
    expect(metrics.revpar).toBeNull();
    expect(metrics.occupancyRate).toBe(0);
  });
});

describe("aggregateMetrics", () => {
  it("sums absolutes and recomputes rates across units", () => {
    const a = unitWindowMetrics([booking("2026-08-01", "2026-08-11", 1000)], AUG);
    const b = unitWindowMetrics([], AUG);
    const portfolio = aggregateMetrics([a, b]);
    expect(portfolio.availableNights).toBe(62);
    expect(portfolio.occupiedNights).toBe(10);
    expect(portfolio.occupancyRate).toBeCloseTo(10 / 62);
    expect(portfolio.adr).toBe(100); // ADR unaffected by empty unit
    expect(portfolio.revpar).toBeCloseTo(1000 / 62);
  });
});

describe("monthWindows", () => {
  it("spans months inclusively and handles year boundaries", () => {
    const windows = monthWindows(d("2026-11-15"), d("2027-01-02"));
    expect(windows.map((w) => w.key)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(windows[1].start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(windows[1].end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
