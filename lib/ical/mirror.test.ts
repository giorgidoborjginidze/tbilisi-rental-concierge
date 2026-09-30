import { describe, expect, it } from "vitest";
import { mirrorSource, planMirrors, type MirrorCandidate } from "./mirror";
import { eventsToBookings } from "./sync";
import { overlapSignals } from "@/lib/alerts/signals";
import { unitWindowMetrics } from "@/lib/analytics/metrics";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

const stay = (
  id: string,
  source: string,
  checkIn: string,
  checkOut: string,
  extra: Partial<MirrorCandidate> = {},
): MirrorCandidate => ({
  id,
  source,
  checkIn: d(checkIn),
  checkOut: d(checkOut),
  amount: null,
  guestName: null,
  mirrorOf: null,
  ...extra,
});

describe("mirrorSource / planMirrors", () => {
  it("marks a Booking.com block that repeats an Airbnb reservation (cross-synced calendars)", () => {
    const stays = [stay("a1", "airbnb", "2026-10-05", "2026-10-08"), stay("b1", "booking", "2026-10-05", "2026-10-08")];
    expect(planMirrors(stays)).toEqual([{ id: "b1", mirrorOf: "airbnb" }]);
  });

  it("marks a block inside a longer stay, and one block over back-to-back stays", () => {
    const stays = [
      stay("a1", "airbnb", "2026-10-05", "2026-10-08"),
      stay("m1", "manual", "2026-10-08", "2026-10-12"),
      stay("inside", "booking", "2026-10-06", "2026-10-07"),
      stay("across", "booking", "2026-10-05", "2026-10-12"),
    ];
    expect(planMirrors(stays)).toEqual([
      { id: "inside", mirrorOf: "airbnb" },
      { id: "across", mirrorOf: "manual" },
    ]);
  });

  it("leaves a Booking.com stay with any night of its own as a real stay", () => {
    const stays = [stay("a1", "airbnb", "2026-10-05", "2026-10-08"), stay("b1", "booking", "2026-10-06", "2026-10-10")];
    expect(planMirrors(stays)).toEqual([]);
  });

  it("a stay the owner priced or named is real, whatever it covers", () => {
    const covers = [{ source: "airbnb", start: d("2026-10-05"), end: d("2026-10-08") }];
    expect(mirrorSource(stay("b1", "booking", "2026-10-05", "2026-10-08", { amount: 300 }), covers)).toBeNull();
    expect(mirrorSource(stay("b1", "booking", "2026-10-05", "2026-10-08", { guestName: "Nino" }), covers)).toBeNull();
  });

  it("nights closed for a long lease are a copy of the lease", () => {
    const stays = [stay("b1", "booking", "2026-10-01", "2026-11-01")];
    expect(planMirrors(stays, [{ start: d("2026-09-01"), end: d("2027-03-01") }])).toEqual([
      { id: "b1", mirrorOf: "lease" },
    ]);
  });

  it("un-marks a copy when the stay it copied is gone (cancelled stays are not passed in)", () => {
    const stays = [stay("b1", "booking", "2026-10-05", "2026-10-08", { mirrorOf: "airbnb" })];
    expect(planMirrors(stays)).toEqual([{ id: "b1", mirrorOf: null }]);
  });

  it("Airbnb stays are never copies (Airbnb marks imported nights itself)", () => {
    const stays = [stay("b1", "booking", "2026-10-05", "2026-10-08"), stay("a1", "airbnb", "2026-10-05", "2026-10-08")];
    // b1 is the copy; a1 is not flagged although b1 covers it.
    expect(planMirrors(stays)).toEqual([{ id: "b1", mirrorOf: "airbnb" }]);
  });

  it("cross-sync end to end: one stay, no overlap alert, no unpriced nights", () => {
    const airbnb = eventsToBookings(
      [{ uid: "a1@airbnb", summary: "Reserved", start: d("2026-10-05"), end: d("2026-10-08"), status: null }],
      "airbnb",
    );
    const booking = eventsToBookings(
      [{ uid: "b1@booking", summary: "CLOSED - Not available", start: d("2026-10-05"), end: d("2026-10-08"), status: null }],
      "booking",
    );
    const rows = [
      { ...stay("a1", "airbnb", "2026-10-05", "2026-10-08"), amount: 450 },
      stay("b1", "booking", "2026-10-05", "2026-10-08"),
    ];
    expect(airbnb).toHaveLength(1);
    expect(booking).toHaveLength(1);
    const changes = planMirrors(rows);
    const mirrors = new Set(changes.filter((c) => c.mirrorOf).map((c) => c.id));
    const live = rows.filter((row) => !mirrors.has(row.id));
    expect(
      overlapSignals(
        live.map((row) => ({ id: row.id, kind: row.source, start: row.checkIn, end: row.checkOut })),
        d("2026-10-01"),
      ),
    ).toEqual([]);
    const metrics = unitWindowMetrics(
      live.map((row) => ({ checkIn: row.checkIn, checkOut: row.checkOut, nights: 3, amount: row.amount })),
      { start: d("2026-10-01"), end: d("2026-11-01") },
    );
    expect(metrics.unpricedNights).toBe(0);
    expect(metrics.occupiedNights).toBe(3);
  });
});
