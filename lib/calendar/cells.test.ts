import { describe, expect, it } from "vitest";
import {
  nightCells,
  nightIndex,
  OVERLAP_CODE,
  STRIP_DAYS,
  stripHandOff,
  stripOpen,
  stripRange,
  stripStart,
  stripStep,
} from "./cells";
import { addDaysKey } from "@/lib/time";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("nightCells", () => {
  it("colours each night by the stay that holds it, a clash as overlap, daily answers only on free nights", () => {
    const stays = [
      { start: d("2026-10-02"), end: d("2026-10-04"), kind: "airbnb" },
      { start: d("2026-10-03"), end: d("2026-10-05"), kind: "booking" },
      { start: d("2026-10-06"), end: d("2026-10-07"), kind: "lease" },
    ];
    const fills = [
      { start: d("2026-10-01"), end: d("2026-10-02"), kind: "day" },
      { start: d("2026-10-06"), end: d("2026-10-07"), kind: "day" },
    ];
    const cells = nightCells(stays, fills, d("2026-10-01"), 8);
    expect(cells).toEqual([
      [3, 3], // Oct 1: daily answer (index after the three stays)
      [1, 0], // Oct 2: airbnb
      [OVERLAP_CODE, 0], // Oct 3: airbnb + booking
      [2, 1], // Oct 4: booking (airbnb checked out)
      [0, -1], // Oct 5: free
      [4, 2], // Oct 6: the lease, not the daily answer
      [0, -1],
      [0, -1],
    ]);
  });
});

describe("the phone's two-week strip", () => {
  it("opens on today when the range holds it, never running past the end", () => {
    expect(stripStart(59, 20, 14)).toBe(20);
    expect(stripStart(59, 55, 14)).toBe(59 - STRIP_DAYS);
    expect(stripStart(59, null, 14)).toBe(14);
    expect(stripStart(10, 3, 0)).toBe(0);
  });

  it("pages by whole fortnights and stops where a full page would leave the range", () => {
    expect(stripStep(20, 59, 1)).toBe(34);
    expect(stripStep(31, 59, 1)).toBe(45); // the last full window
    expect(stripStep(32, 59, 1)).toBeNull(); // 13 nights left: the next month takes over
    expect(stripStep(45, 59, 1)).toBeNull();
    expect(stripStep(20, 59, -1)).toBe(6);
    expect(stripStep(14, 59, -1)).toBe(0);
    expect(stripStep(6, 59, -1)).toBeNull(); // the previous month takes over
    expect(stripStep(0, 59, -1)).toBeNull();
  });

  it("hands over the night after the last shown, or the fortnight before the first", () => {
    expect(stripHandOff(45, 59, 1)).toBe(59);
    expect(stripHandOff(40, 59, 1)).toBe(54);
    expect(stripHandOff(6, 59, -1)).toBe(-8);
    expect(addDaysKey("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(nightIndex(new Date("2026-09-17T00:00:00Z"), "2026-10-01")).toBe(14);
    expect(nightIndex(new Date("2026-09-17T00:00:00Z"), "junk")).toBeNull();
    expect(stripRange(2026, 10)).toEqual({ from: new Date("2026-09-17T00:00:00Z"), days: 14 + 31 + 28, monthIndex: 14 });
  });

  it("opens on the carried-over night, else today only in today's month, else the month's first night", () => {
    const opts = { from: null, today: 43, currentMonth: true, fallback: 14 };
    expect(stripOpen(72, opts)).toBe(43);
    expect(stripOpen(72, { ...opts, currentMonth: false })).toBe(14);
    expect(stripOpen(72, { ...opts, from: 30 })).toBe(30);
    expect(stripOpen(72, { ...opts, from: 500 })).toBe(43); // outside the range: ignored
    expect(stripOpen(72, { ...opts, from: 70 })).toBe(72 - STRIP_DAYS); // never past the end
  });

  it("hands paging over to the neighbouring month without repeating or skipping a night", () => {
    // Walk forward from today (30 Sep 2026) across three month hand-offs,
    // then back again, the way the strip and the page do it.
    type View = { year: number; month: number; from: string | null };
    const today = "2026-09-30";
    const open = (view: View) => {
      const range = stripRange(view.year, view.month);
      const key = `${view.year}-${String(view.month).padStart(2, "0")}`;
      const start = stripOpen(range.days, {
        from: nightIndex(range.from, view.from ?? undefined),
        today: nightIndex(range.from, today),
        currentMonth: key === today.slice(0, 7),
        fallback: range.monthIndex,
      });
      return { range, start };
    };
    const firstKey = (range: { from: Date }) => range.from.toISOString().slice(0, 10);
    const shift = (view: View, direction: -1 | 1, from: string | undefined): View => {
      if (!from) throw new Error("no hand-off night");
      const month = view.month + direction;
      if (month === 0) return { year: view.year - 1, month: 12, from };
      if (month === 13) return { year: view.year + 1, month: 1, from };
      return { year: view.year, month, from };
    };

    let view: View = { year: 2026, month: 9, from: null };
    let { range, start } = open(view);
    const windows: string[] = [];
    const shown = () => {
      const end = Math.min(range.days, start + STRIP_DAYS);
      windows.push(`${addDaysKey(firstKey(range), start)}..${addDaysKey(firstKey(range), end - 1)}`);
    };
    shown();
    expect(windows[0]).toBe("2026-09-30..2026-10-13");
    for (let page = 0; page < 10; page++) {
      const next = stripStep(start, range.days, 1);
      if (next != null) {
        start = next;
      } else {
        view = shift(view, 1, addDaysKey(firstKey(range), stripHandOff(start, range.days, 1)));
        ({ range, start } = open(view));
      }
      shown();
    }
    // Every page is a whole fortnight and begins the night after the
    // previous one ended — no night repeated, none skipped.
    for (let i = 1; i < windows.length; i++) {
      const prevEnd = windows[i - 1].split("..")[1];
      const [from, to] = windows[i].split("..");
      expect(from).toBe(addDaysKey(prevEnd, 1));
      expect(to).toBe(addDaysKey(from, STRIP_DAYS - 1));
    }
    // The reviewer's walk: 30 Sep–13 Oct, 14–27 Oct, then October's strip
    // opens on 28 Oct (not back on today).
    expect(windows.slice(0, 3)).toEqual(["2026-09-30..2026-10-13", "2026-10-14..2026-10-27", "2026-10-28..2026-11-10"]);
    expect(view).toMatchObject({ year: 2027, month: 2 }); // it crossed months and the year end

    // And back: each page ends the night before the previous one began.
    const back: string[] = [windows[windows.length - 1]];
    for (let page = 0; page < 10; page++) {
      const prev = stripStep(start, range.days, -1);
      if (prev != null) {
        start = prev;
      } else {
        view = shift(view, -1, addDaysKey(firstKey(range), stripHandOff(start, range.days, -1)));
        ({ range, start } = open(view));
      }
      const end = Math.min(range.days, start + STRIP_DAYS);
      back.push(`${addDaysKey(firstKey(range), start)}..${addDaysKey(firstKey(range), end - 1)}`);
    }
    for (let i = 1; i < back.length; i++) {
      const [prevStart] = back[i - 1].split("..");
      const [from, to] = back[i].split("..");
      expect(to).toBe(addDaysKey(prevStart, -1));
      // Every page is a whole fortnight.
      const nights = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
      expect(nights).toBe(STRIP_DAYS);
    }
  });
});
