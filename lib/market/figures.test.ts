import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { summarizeSources } from "./figures";

const part = (source: string, sourceName: string, period: string, sampleSize: number) => ({
  source, sourceName, period, sampleSize, value: 1, weight: 1,
});

describe("naming the sources", () => {
  it("names each source once, reports with their newest month", () => {
    const line = summarizeSources(
      [
        { estimate: false, parts: [part("report", "TBC Capital", "2026-07", 0), part("listings", "myhome.ge", "2026-10", 8)] },
        { estimate: false, parts: [part("report", "TBC Capital", "2026-09", 0), part("listings", "myhome.ge", "2026-10", 6), part("activo", "", "2026-10", 12)] },
        { estimate: true, parts: [] },
      ],
      { listings: "listings", activo: "Activo" },
    );
    expect(line).toBe("TBC Capital 2026-09 · myhome.ge (8) · Activo (12)");
    expect(summarizeSources([{ estimate: true, parts: [] }, null], { listings: "l", activo: "a" })).toBeNull();
  });
});
