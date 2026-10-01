import { describe, expect, it } from "vitest";
import { blendFigures, trimmedMedian } from "./blend";

describe("market figures blend", () => {
  it("weighs a report fully and counted sources by their sample", () => {
    const blended = blendFigures(
      [
        { source: "report", sourceName: "TBC Capital", period: "2026-09", value: 30, sampleSize: 0 },
        { source: "activo", sourceName: "", period: "2026-09", value: 20, sampleSize: 3 },
      ],
      "2026-10",
    )!;
    expect(blended.parts[0].source).toBe("report");
    // A 3-contract figure barely moves a report.
    expect(blended.value).toBeGreaterThan(28);
    expect(blended.value).toBeLessThan(30);
  });

  it("keeps each source's newest fresh figure and drops stale ones", () => {
    const blended = blendFigures(
      [
        { source: "listings", sourceName: "", period: "2026-02", value: 99, sampleSize: 100 },
        { source: "listings", sourceName: "", period: "2026-08", value: 25, sampleSize: 60 },
        { source: "listings", sourceName: "", period: "2026-09", value: 27, sampleSize: 60 },
      ],
      "2026-10",
    )!;
    expect(blended.parts).toHaveLength(1);
    expect(blended.value).toBe(27);
    expect(blendFigures([{ source: "report", sourceName: "x", period: "2025-01", value: 9, sampleSize: 0 }], "2026-10")).toBeNull();
  });

  it("finds a robust centre", () => {
    expect(trimmedMedian([10, 11, 12, 13, 14, 15, 16, 17, 18, 500])).toBe(14.5);
    expect(trimmedMedian([])).toBeNull();
  });
});
