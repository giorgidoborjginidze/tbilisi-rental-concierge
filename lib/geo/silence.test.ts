import { describe, expect, it } from "vitest";
import { isTrackerSilent, silenceKey, silenceSpan, TRACKER_SILENT_MINUTES } from "./silence";

const now = new Date("2026-09-30T09:45:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

describe("tracker silence", () => {
  it("counts a tracker silent only after the threshold", () => {
    expect(TRACKER_SILENT_MINUTES).toBe(30);
    expect(isTrackerSilent(ago(29), now)).toBe(false);
    expect(isTrackerSilent(ago(30), now)).toBe(false);
    expect(isTrackerSilent(ago(31), now)).toBe(true);
    // The demo Camry: last fix at 06:38 UTC, three hours before.
    expect(isTrackerSilent(new Date("2026-09-30T06:38:06Z"), now)).toBe(true);
  });

  it("never calls a tracker that has not reported yet silent", () => {
    expect(isTrackerSilent(null, now)).toBe(false);
  });

  it("takes a configurable threshold", () => {
    expect(isTrackerSilent(ago(11), now, 10)).toBe(true);
  });

  it("describes the silence in the largest sensible unit", () => {
    expect(silenceSpan(ago(45), now)).toEqual({ n: 45, unit: "min" });
    expect(silenceSpan(ago(187), now)).toEqual({ n: 3, unit: "hours" });
    expect(silenceSpan(ago(60 * 50), now)).toEqual({ n: 2, unit: "days" });
  });

  it("keys one alert per silence episode", () => {
    expect(silenceKey("TLT-1", ago(60))).toBe(`TLT-1|${ago(60).toISOString()}`);
  });
});
