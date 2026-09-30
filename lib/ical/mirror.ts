// Which imported stays are only a copy of another stay — pure, no I/O.
//
// Owners usually cross-sync their channels: the Airbnb calendar is
// imported into Booking.com and the other way round. Airbnb re-exports the
// nights it imported as "Airbnb (Not available)", which the parser already
// skips (./sync isOwnerBlock). Booking.com does not tell a reservation from
// a closed date — every event is "CLOSED - Not available" — so the nights
// it closed because Airbnb sold them come back through its feed as one
// more "stay". Counted as a stay, every Airbnb reservation on such a unit
// would raise a double-booking alert and a stay without a price.
//
// A Booking.com stay whose every night another stay on the unit already
// holds (a stay from another channel, a manual or direct booking, or a
// long lease) is therefore a MIRROR: kept for the record, still occupied
// (the stay it copies holds those nights), but left out of revenue,
// overlaps and the "no price" counts. The check covers an exact copy, a
// copy inside a longer stay, and one closed block over back-to-back stays.
//
// Trade-off: a genuine Booking.com guest booked entirely inside another
// channel's stay (a real double booking, possible only if the channels'
// sync lagged) looks the same and is marked a mirror too. It stays visible
// on /bookings as a copy, and an owner who gives it a price or a guest name
// makes it a stay in its own right again.

import { mergeIntervals, type Interval } from "@/lib/calendar/occupancy";

/** Channels whose export repeats the nights they imported from others. */
const MIRRORING_SOURCES = new Set(["booking"]);

export interface MirrorCandidate {
  id: string;
  source: string;
  checkIn: Date;
  checkOut: Date;
  amount: number | null;
  guestName: string | null;
  /** The stored marker. */
  mirrorOf: string | null;
}

export interface Cover extends Interval {
  /** "airbnb" | "direct" | "manual" | "lease" — shown as "copy of …". */
  source: string;
}

const overlapNights = (a: Interval, b: Interval) => {
  const start = Math.max(a.start.getTime(), b.start.getTime());
  const end = Math.min(a.end.getTime(), b.end.getTime());
  return end > start ? Math.round((end - start) / 86_400_000) : 0;
};

/**
 * The source of the stays a candidate copies, or null when it is a stay in
 * its own right. `covers` are the unit's other live stays and leases.
 */
export function mirrorSource(stay: MirrorCandidate, covers: Cover[]): string | null {
  if (!MIRRORING_SOURCES.has(stay.source)) return null;
  // The owner priced it or named the guest: a real reservation.
  if (stay.amount != null || (stay.guestName ?? "").trim() !== "") return null;
  if (stay.checkOut.getTime() <= stay.checkIn.getTime()) return null;

  const own: Interval = { start: stay.checkIn, end: stay.checkOut };
  const touching = covers.filter((cover) => overlapNights(cover, own) > 0);
  if (touching.length === 0) return null;
  // Every night must be held: some merged block of the covers contains it.
  const held = mergeIntervals(touching).some(
    (block) =>
      block.start.getTime() <= stay.checkIn.getTime() &&
      block.end.getTime() >= stay.checkOut.getTime(),
  );
  if (!held) return null;
  // Named after the source holding most of its nights.
  const nightsBySource = new Map<string, number>();
  for (const cover of touching) {
    nightsBySource.set(cover.source, (nightsBySource.get(cover.source) ?? 0) + overlapNights(cover, own));
  }
  return [...nightsBySource.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

/**
 * The marker changes for one unit's live (non-cancelled) stays, given its
 * leases. Only stays whose marker differs from the stored one are listed.
 */
export function planMirrors(
  stays: MirrorCandidate[],
  leases: Interval[] = [],
): { id: string; mirrorOf: string | null }[] {
  const covers: Cover[] = [
    ...stays
      .filter((stay) => !MIRRORING_SOURCES.has(stay.source))
      .map((stay) => ({ source: stay.source, start: stay.checkIn, end: stay.checkOut })),
    ...leases.map((lease) => ({ source: "lease", start: lease.start, end: lease.end })),
  ];
  const changes: { id: string; mirrorOf: string | null }[] = [];
  for (const stay of stays) {
    const next = mirrorSource(stay, covers);
    if (next !== stay.mirrorOf) changes.push({ id: stay.id, mirrorOf: next });
  }
  return changes;
}
