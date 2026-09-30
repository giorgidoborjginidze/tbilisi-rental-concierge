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
/** Nights the strip loads before the month's first night… */
export const STRIP_PAD_BEFORE = 14;
/** …and after its last, so a window near the month's end still pages by fortnights. */
export const STRIP_PAD_AFTER = 28;

/** The nights one month's strip loads: its first night and how many. */
export function stripRange(year: number, month: number): { from: Date; days: number; monthIndex: number } {
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 1);
  const from = new Date(monthStart - STRIP_PAD_BEFORE * DAY_MS);
  const days = Math.round((monthEnd - monthStart) / DAY_MS) + STRIP_PAD_BEFORE + STRIP_PAD_AFTER;
  return { from, days, monthIndex: STRIP_PAD_BEFORE };
}

/**
 * Where the window opens inside a loaded range of `days` nights: on
 * `preferred` when the range holds it, else on `fallback` (the month's
 * first night), never running past the range's end.
 */
export function stripStart(days: number, preferred: number | null, fallback: number): number {
  const last = Math.max(0, days - STRIP_DAYS);
  const wanted = preferred != null && preferred >= 0 && preferred < days ? preferred : fallback;
  return Math.min(Math.max(0, wanted), last);
}

/**
 * The night the strip opens on: `from` — the night carried over from the
 * neighbouring month's strip, so paging continues where it left off — when
 * the range holds it; else today, but only when the month shown is today's
 * month (a month opened from the header starts on its first night);
 * else the month's first night.
 */
export function stripOpen(
  days: number,
  opts: { from: number | null; today: number | null; currentMonth: boolean; fallback: number },
): number {
  const inRange = (index: number | null): index is number => index != null && index >= 0 && index < days;
  if (inRange(opts.from)) return stripStart(days, opts.from, opts.fallback);
  if (opts.currentMonth && inRange(opts.today)) return stripStart(days, opts.today, opts.fallback);
  return stripStart(days, null, opts.fallback);
}

/**
 * One page back or forward: always a whole fortnight, so no night is shown
 * twice or skipped. Null when the next full page would leave the range —
 * the neighbouring month's strip takes over from there (`stripHandOff`).
 */
export function stripStep(start: number, days: number, direction: -1 | 1): number | null {
  if (direction < 0) return start - STRIP_DAYS >= 0 ? start - STRIP_DAYS : null;
  return start + 2 * STRIP_DAYS <= days ? start + STRIP_DAYS : null;
}

/**
 * Past the range's edge: the night the neighbouring month's strip should
 * open on, as an offset from this range's first night — the night after
 * the last one shown (forward), or two weeks before the first one shown
 * (back). The offset may lie outside this range.
 */
export function stripHandOff(start: number, days: number, direction: -1 | 1): number {
  return direction < 0 ? start - STRIP_DAYS : Math.min(days, start + STRIP_DAYS);
}

/** The index of the night `key` ("YYYY-MM-DD") in a range starting at `from`; null when malformed. */
export function nightIndex(from: Date, key: string | undefined): number | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const at = Date.parse(`${key}T00:00:00Z`);
  if (Number.isNaN(at)) return null;
  return Math.round((at - from.getTime()) / DAY_MS);
}
