"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CELL_CLASS, OVERLAP_CODE, STRIP_DAYS, stripStart, stripStep } from "@/lib/calendar/cells";
import { IconChevronLeft, IconChevronRight } from "../icons";

export interface StripDay {
  /** "YYYY-MM-DD" */
  key: string;
  /** Short weekday and day number, as the phone shows them. */
  wd: string;
  d: string;
  /** "30 სექ" — for the range line and each cell's name. */
  title: string;
  weekend: boolean;
}

export interface StripRow {
  key: string;
  name: string;
  /** The place: its own calendar (a unit) or its page (a flat under Assets). */
  href: string;
  /** A free night opens this with the night's date appended (the add-a-stay form). */
  addHref: string | null;
  /** [colour code, stay index] per night of the loaded range (lib/calendar/cells.ts). */
  cells: [number, number][];
  /** What a taken night opens, and what it is. */
  stays: { href: string; label: string }[];
  /** A free night's suggested price, by night index. */
  prices: Record<number, string>;
}

// /calendar on a phone: two weeks at a time instead of a month of 9-px
// slivers. Full unit names stay pinned on the left while the days scroll,
// today's column is marked, and every cell is a link — a taken night opens
// its booking (or contract), a free one the add-a-stay form on that date.
// The server sends the month and two weeks either side; paging past that
// goes to the neighbouring month.
export default function CalendarStrip({
  days,
  rows,
  todayIndex,
  fallbackIndex,
  prevMonthHref,
  nextMonthHref,
  labels,
}: {
  days: StripDay[];
  rows: StripRow[];
  todayIndex: number | null;
  /** Where the window opens when today is not in the range (the month's first night). */
  fallbackIndex: number;
  prevMonthHref: string;
  nextMonthHref: string;
  labels: {
    prev: string;
    next: string;
    prevMonth: string;
    nextMonth: string;
    today: string;
    free: string;
    overlap: string;
  };
}) {
  const home = stripStart(days.length, todayIndex, fallbackIndex);
  const [start, setStart] = useState(home);
  const scrollRef = useRef<HTMLDivElement>(null);

  // A new window starts at its first day.
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, [start]);

  const end = Math.min(days.length, start + STRIP_DAYS);
  const visible = Array.from({ length: end - start }, (_, i) => start + i);
  const back = stripStep(start, days.length, -1);
  const forward = stripStep(start, days.length, 1);

  const cellTitle = (row: StripRow, index: number) => {
    const [code, stay] = row.cells[index];
    const day = days[index].title;
    if (stay >= 0) {
      const label = row.stays[stay]?.label ?? "";
      return code === OVERLAP_CODE ? `${day} — ${labels.overlap}: ${label}` : `${day} — ${label}`;
    }
    const price = row.prices[index];
    return `${day} — ${labels.free}${price ? ` · ${price}` : ""}`;
  };
  const cellHref = (row: StripRow, index: number) => {
    const stay = row.cells[index][1];
    if (stay >= 0) return row.stays[stay]?.href ?? row.href;
    return row.addHref ? `${row.addHref}${days[index].key}` : row.href;
  };

  const pager = (direction: -1 | 1) => {
    const target = direction < 0 ? back : forward;
    const label = direction < 0 ? labels.prev : labels.next;
    const icon = direction < 0 ? <IconChevronLeft size={18} /> : <IconChevronRight size={18} />;
    if (target == null) {
      // Past the loaded range: the neighbouring month.
      const monthLabel = direction < 0 ? labels.prevMonth : labels.nextMonth;
      return (
        <Link
          href={direction < 0 ? prevMonthHref : nextMonthHref}
          className="btn-chip btn-chip--icon"
          aria-label={monthLabel}
          title={monthLabel}
        >
          {icon}
        </Link>
      );
    }
    return (
      <button
        type="button"
        className="btn-chip btn-chip--icon"
        aria-label={label}
        title={label}
        onClick={() => setStart(target)}
      >
        {icon}
      </button>
    );
  };

  return (
    <div className="card cal-strip">
      <div className="cal-strip__bar">
        {pager(-1)}
        <b className="cal-strip__range" aria-live="polite">
          {days[start]?.title} – {days[end - 1]?.title}
        </b>
        {pager(1)}
        {todayIndex != null && start !== home && (
          <button type="button" className="btn-chip" onClick={() => setStart(home)}>
            {labels.today}
          </button>
        )}
      </div>
      <div className="cal-strip__scroll" ref={scrollRef}>
        <div className="cal-strip__grid" style={{ "--n": visible.length } as React.CSSProperties}>
          <span className="cal-strip__corner" aria-hidden />
          {visible.map((index) => (
            <span
              key={days[index].key}
              className={`cal-strip__day${index === todayIndex ? " is-today" : ""}${days[index].weekend ? " is-weekend" : ""}`}
              aria-current={index === todayIndex ? "date" : undefined}
            >
              <small>{days[index].wd}</small>
              <b>{days[index].d}</b>
            </span>
          ))}
          {rows.map((row) => (
            <Fragment key={row.key}>
              <Link href={row.href} className="cal-strip__name" prefetch={false}>
                {row.name}
              </Link>
              {visible.map((index) => {
                const title = cellTitle(row, index);
                return (
                  <Link
                    key={index}
                    href={cellHref(row, index)}
                    prefetch={false}
                    className={`cal-strip__cell cal-cell ${CELL_CLASS[row.cells[index][0]] ?? ""}${index === todayIndex ? " is-today" : ""}`}
                    title={title}
                    aria-label={title}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
