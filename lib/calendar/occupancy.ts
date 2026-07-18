// Pure interval math for the booking calendar: vacancy gaps and
// overlap (double-booking) detection. No framework, no I/O.

export interface Interval {
  start: Date;
  end: Date; // exclusive (checkout day)
}

export interface Stay extends Interval {
  id: string;
  kind: string; // airbnb | booking | direct | manual | lease
}

export interface Gap extends Interval {
  nights: number;
}

export interface Overlap extends Interval {
  nights: number;
  stayIds: [string, string];
  kinds: [string, string];
}

const nightsBetween = (start: Date, end: Date) =>
  Math.round((end.getTime() - start.getTime()) / 86_400_000);

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    // Touching intervals (checkout == next check-in) merge: the unit is
    // continuously occupied, back-to-back stays are not a vacancy.
    if (last && interval.start.getTime() <= last.end.getTime()) {
      if (interval.end.getTime() > last.end.getTime()) last.end = interval.end;
    } else {
      merged.push({ start: interval.start, end: interval.end });
    }
  }
  return merged;
}

// Free windows of at least minNights inside [window.start, window.end).
export function findGaps(
  stays: Interval[],
  window: Interval,
  minNights = 1,
): Gap[] {
  const clipped = stays
    .filter((s) => s.start < window.end && s.end > window.start)
    .map((s) => ({
      start: s.start < window.start ? window.start : s.start,
      end: s.end > window.end ? window.end : s.end,
    }));
  const merged = mergeIntervals(clipped);

  const gaps: Gap[] = [];
  let cursor = window.start;
  for (const interval of [...merged, { start: window.end, end: window.end }]) {
    const nights = nightsBetween(cursor, interval.start);
    if (nights >= minNights) {
      gaps.push({ start: cursor, end: interval.start, nights });
    }
    if (interval.end > cursor) cursor = interval.end;
  }
  return gaps;
}

// Every pair of stays that occupy the same nights — a double-booking.
export function findOverlaps(stays: Stay[]): Overlap[] {
  const sorted = [...stays].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const overlaps: Overlap[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (b.start.getTime() >= a.end.getTime()) break; // sorted: no later b overlaps a
      const start = a.start > b.start ? a.start : b.start;
      const end = a.end < b.end ? a.end : b.end;
      const nights = nightsBetween(start, end);
      if (nights > 0) {
        overlaps.push({
          start,
          end,
          nights,
          stayIds: [a.id, b.id],
          kinds: [a.kind, b.kind],
        });
      }
    }
  }
  return overlaps;
}
