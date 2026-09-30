import { describe, expect, it } from "vitest";
import type { Stay } from "@/lib/calendar/occupancy";
import {
  overlapSignals,
  staleOverlapAlerts,
  staleVacancyAlerts,
  vacancySignals,
} from "./signals";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const stay = (id: string, start: string, end: string, kind = "airbnb"): Stay => ({
  id,
  kind,
  start: d(start),
  end: d(end),
});

describe("free windows keep one identity from day to day", () => {
  // Checked out on the 28th; next guest arrives on 6 October.
  const stays = [stay("prev", "2026-09-25", "2026-09-28"), stay("next", "2026-10-06", "2026-10-09")];

  it("is keyed by the stays that bound it, not by today", () => {
    const day1 = vacancySignals(stays, d("2026-10-01"));
    const day2 = vacancySignals(stays, d("2026-10-02"));
    expect(day1[0].key).toBe("2026-09-28|2026-10-06");
    expect(day2[0].key).toBe(day1[0].key);
    // The figures follow today: fewer nights left to sell.
    expect(day1[0]).toMatchObject({ start: d("2026-10-01"), end: d("2026-10-06"), nights: 5 });
    expect(day2[0]).toMatchObject({ start: d("2026-10-02"), nights: 4, openEnd: false });
  });

  it("keeps the key of a window between two future stays once it becomes the first one", () => {
    const later = [...stays, stay("far", "2026-10-12", "2026-10-15")];
    const before = vacancySignals(later, d("2026-10-01")).find((g) => g.start.getTime() === d("2026-10-09").getTime());
    const after = vacancySignals(later, d("2026-10-10"))[0];
    expect(before?.key).toBe("2026-10-09|2026-10-12");
    expect(after.key).toBe("2026-10-09|2026-10-12");
  });

  it("marks a window with nothing booked after it as open-ended, with a stable key", () => {
    const empty = [stay("prev", "2026-09-20", "2026-09-28")];
    const a = vacancySignals(empty, d("2026-10-01"));
    const b = vacancySignals(empty, d("2026-10-05"));
    expect(a[0]).toMatchObject({ key: "2026-09-28|open", openEnd: true, nights: 30 });
    expect(b[0].key).toBe(a[0].key);
    expect(vacancySignals([], d("2026-10-01"))[0].key).toBe("open|open");
  });

  it("only raises windows that start within 14 days and last at least 2 nights", () => {
    const booked = [
      stay("a", "2026-09-28", "2026-10-20"),
      stay("b", "2026-10-21", "2026-10-25"), // one free night: too short
    ];
    // The next real gap starts on the 25th: 24 days away.
    expect(vacancySignals(booked, d("2026-10-01"))).toEqual([]);
    expect(vacancySignals(booked, d("2026-10-12")).map((g) => g.key)).toEqual(["2026-10-25|open"]);
  });

  it("treats a lease like any other stay", () => {
    const withLease = [stay("lease", "2026-09-01", "2027-09-01", "lease")];
    expect(vacancySignals(withLease, d("2026-10-01"))).toEqual([]);
  });
});

describe("vacancy alerts that no longer hold close themselves", () => {
  const today = d("2026-10-02");
  const alert = (id: string, key: string, start: string, end: string) => ({
    id,
    payload: { key, start, end, nights: 3 },
  });

  it("keeps an alert whose window still stands", () => {
    const stale = staleVacancyAlerts(
      [alert("a1", "2026-09-28|2026-10-06", "2026-10-01", "2026-10-06")],
      new Set(["2026-09-28|2026-10-06"]),
      [],
      today,
    );
    expect(stale).toEqual([]);
  });

  it("closes a window that has been booked as filled", () => {
    const stale = staleVacancyAlerts(
      [alert("a1", "2026-09-28|2026-10-06", "2026-10-01", "2026-10-06")],
      new Set(["2026-10-04|2026-10-06"]),
      [stay("new", "2026-10-02", "2026-10-04")],
      today,
    );
    expect(stale).toEqual([{ id: "a1", reason: "filled" }]);
  });

  it("closes a window whose dates are over, or with less than two nights left", () => {
    const stale = staleVacancyAlerts(
      [
        alert("gone", "2026-09-20|2026-09-30", "2026-09-20", "2026-09-30"),
        alert("last", "2026-09-28|2026-10-03", "2026-10-01", "2026-10-03"),
      ],
      new Set(),
      [],
      today,
    );
    expect(stale).toEqual([
      { id: "gone", reason: "passed" },
      { id: "last", reason: "passed" },
    ]);
  });

  it("replaces an alert from before windows had stable keys", () => {
    // Old format: keyed by the day the window started.
    const stale = staleVacancyAlerts(
      [alert("old", "2026-10-01", "2026-10-01", "2026-10-06")],
      new Set(["2026-09-28|2026-10-06"]),
      [],
      today,
    );
    expect(stale).toEqual([{ id: "old", reason: "replaced" }]);
  });
});

describe("double bookings", () => {
  const today = d("2026-10-01");

  it("finds two stays sharing nights, with both sources, keyed by the pair", () => {
    const found = overlapSignals(
      [
        stay("zeta", "2026-10-03", "2026-10-07", "airbnb"),
        stay("alpha", "2026-10-05", "2026-10-09", "direct"),
        stay("other", "2026-10-09", "2026-10-11", "booking"), // back-to-back is fine
      ],
      today,
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      key: "alpha|zeta",
      start: d("2026-10-05"),
      end: d("2026-10-07"),
      nights: 2,
    });
    expect(found[0].stays.map((s) => s.kind)).toEqual(["direct", "airbnb"]);
  });

  it("includes a lease and ignores clashes already in the past or beyond 90 days", () => {
    const found = overlapSignals(
      [
        stay("lease", "2026-09-01", "2027-03-01", "lease"),
        stay("stay", "2026-10-10", "2026-10-12", "booking"),
        stay("past1", "2026-08-01", "2026-08-05"),
        stay("past2", "2026-08-03", "2026-08-06"),
      ],
      today,
    );
    expect(found.map((o) => o.key)).toEqual(["lease|stay"]);
    expect(
      overlapSignals([stay("x", "2027-02-01", "2027-02-05"), stay("y", "2027-02-02", "2027-02-04")], today),
    ).toEqual([]);
  });

  it("closes an overlap alert once one stay moved or was cancelled, or its dates passed", () => {
    const stale = staleOverlapAlerts(
      [
        { id: "live", payload: { key: "a|b", end: "2026-10-07" } },
        { id: "fixed", payload: { key: "a|c", end: "2026-10-07" } },
        { id: "over", payload: { key: "d|e", end: "2026-09-30" } },
      ],
      new Set(["a|b"]),
      today,
    );
    expect(stale).toEqual([
      { id: "fixed", reason: "overlap_cleared" },
      { id: "over", reason: "passed" },
    ]);
  });
});
