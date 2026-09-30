// One calendar cell per night: its colour and the stay that holds it, for
// the month board and the phone's two-week strip on /calendar. Pure,
// client-safe.

const DAY_MS = 86_400_000;

/** Colour classes, by code (0: free). */
export const CELL_CLASS = [
  "",
  "cal-cell--airbnb",
  "cal-cell--booking",
  "cal-cell--direct",
  "cal-cell--lease",
  "cal-cell--overlap",
] as const;

export const OVERLAP_CODE = 5;

const KIND_CODE: Record<string, number> = {
  airbnb: 1,
  booking: 2,
  direct: 3,
  manual: 3,
  // A day-let contract and a "rented today?" answer are let directly.
  contract: 3,
  day: 3,
  lease: 4,
};

export interface CellStay {
  start: Date;
  end: Date;
  kind: string;
}

/**
 * [code, stay] per night of [start, start + days): the colour code and the
 * index of the stay that holds the night (the first of two when they
 * clash), -1 when it is free. `stays` are bookings, leases and contracts;
 * `fills` are daily answers, which only fill a night no stay holds; their
 * indices follow the stays' (stays.length + i).
 */
export function nightCells(
  stays: readonly CellStay[],
  fills: readonly CellStay[],
  start: Date,
  days: number,
): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < days; i++) {
    const from = start.getTime() + i * DAY_MS;
    const to = from + DAY_MS;
    const holds = (stay: CellStay) => stay.start.getTime() < to && stay.end.getTime() > from;
    const covering: number[] = [];
    stays.forEach((stay, index) => {
      if (holds(stay)) covering.push(index);
    });
    if (covering.length > 1) {
      out.push([OVERLAP_CODE, covering[0]]);
    } else if (covering.length === 1) {
      out.push([KIND_CODE[stays[covering[0]].kind] ?? KIND_CODE.direct, covering[0]]);
    } else {
      const fill = fills.findIndex(holds);
      out.push(fill >= 0 ? [KIND_CODE.day, stays.length + fill] : [0, -1]);
    }
  }
  return out;
}

/** The two-week window on a phone: how many nights it shows. */
export const STRIP_DAYS = 14;

/**
 * Where the window opens inside a loaded range of `days` nights: on today
 * when the range holds it, else on `fallback` (the month's first night),
 * never running past the range's end.
 */
export function stripStart(days: number, todayIndex: number | null, fallback: number): number {
  const last = Math.max(0, days - STRIP_DAYS);
  const wanted = todayIndex != null && todayIndex >= 0 && todayIndex < days ? todayIndex : fallback;
  return Math.min(Math.max(0, wanted), last);
}

/** One page back or forward, kept inside the range; null past its edge. */
export function stripStep(start: number, days: number, direction: -1 | 1): number | null {
  const last = Math.max(0, days - STRIP_DAYS);
  if (direction < 0) return start <= 0 ? null : Math.max(0, start - STRIP_DAYS);
  return start >= last ? null : Math.min(last, start + STRIP_DAYS);
}
