"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { saveContract } from "@/lib/assets/actions";
import { saveDayRange } from "@/lib/rentals/actions";
import type { FormState } from "@/lib/units/actions";
import { IconChevronLeft, IconChevronRight } from "@/app/icons";
import { keepTyped } from "@/app/keep-typed";
import { Req } from "@/app/form-bits";
import { addDaysKey } from "@/lib/time";

/** Blank cells before a month's first day in a Monday-first week. */
const mondayOffset = (iso: string | undefined) =>
  iso ? (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;

export interface CalDay {
  iso: string; // "YYYY-MM-DD"
  cls: string;
  title: string;
}
export interface CalMonth {
  /** Short, for the desktop grid's row ("სექ"). */
  label: string;
  /** Month and year, for the phone's month view title ("სექტემბერი, 2026"). */
  longLabel: string;
  current: boolean;
  days: CalDay[];
}

// Per-asset occupancy calendar with drag-to-mark: swipe across days to
// select a range, then save it. A day-let asset records the nights as
// daily answers — the same record as the dashboard's "rented today?"
// (lib/rentals/actions.ts saveDayRange); a long-term asset records a
// rental contract (dates + price prefilled). Pointer events cover mouse
// and touch alike.
export default function OccupancyCalendar({
  assetId,
  months,
  defaultRate,
  isDaily,
  labels,
  weekdays,
  todayIso,
}: {
  assetId: string;
  months: CalMonth[];
  /** Prefill for the price field: the day rate, or the last monthly rent. */
  defaultRate: number | null;
  isDaily: boolean;
  labels: Record<string, string>;
  /** Short weekday names, Monday first — the phone's month view. */
  weekdays: string[];
  /** Today in Tbilisi ("YYYY-MM-DD"), marked on the month view. */
  todayIso: string;
}) {
  // Live drag endpoints (state drives the highlight, refs feed the
  // window-level pointerup handler without stale closures).
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const anchorRef = useRef<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const dragging = useRef(false);
  const submitted = useRef(false);
  // Phones: one month at a time as a 7-column month view (cells a thumb
  // can hit), and taps instead of a drag — the first tap picks a night,
  // the second the last night of the range. The page still scrolls.
  const currentMonth = Math.max(0, months.findIndex((month) => month.current));
  const [shown, setShown] = useState(currentMonth);
  const [tapAnchor, setTapAnchor] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    isDaily ? saveDayRange : saveContract,
    null,
  );

  // A successful save refreshes the server data; clear the selection.
  useEffect(() => {
    if (submitted.current && !pending && !state?.error) {
      submitted.current = false;
      setRange(null);
      setAnchor(null);
      setHover(null);
      setTapAnchor(null);
    }
  }, [pending, state]);

  useEffect(() => {
    const endDrag = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (anchorRef.current && hoverRef.current) {
        const [start, end] = [anchorRef.current, hoverRef.current].sort();
        setRange({ start, end });
      }
    };
    window.addEventListener("pointerup", endDrag);
    return () => window.removeEventListener("pointerup", endDrag);
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    const iso = (event.target as HTMLElement).dataset?.iso;
    if (!iso) return;
    event.preventDefault();
    dragging.current = true;
    setRange(null);
    anchorRef.current = iso;
    hoverRef.current = iso;
    setAnchor(iso);
    setHover(iso);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    const el = document.elementFromPoint(event.clientX, event.clientY) as
      | HTMLElement
      | null;
    const iso = el?.dataset?.iso;
    if (iso) {
      hoverRef.current = iso;
      setHover(iso);
    }
  };

  const onTap = (iso: string) => {
    if (tapAnchor == null) {
      // First tap: one night, the form opens; a second tap extends it.
      setTapAnchor(iso);
      setRange({ start: iso, end: iso });
    } else {
      const [start, end] = [tapAnchor, iso].sort();
      setTapAnchor(null);
      setRange({ start, end });
    }
  };

  const selStart = range?.start ?? (anchor && hover ? [anchor, hover].sort()[0] : null);
  const selEnd = range?.end ?? (anchor && hover ? [anchor, hover].sort()[1] : null);
  const inSelection = (iso: string) =>
    selStart != null && selEnd != null && iso >= selStart && iso <= selEnd;

  // Checkout convention: the contract ends the day AFTER the last
  // selected night (same as booking check-out).
  const dayAfter = (iso: string) => addDaysKey(iso, 1);

  const nights =
    range == null
      ? 0
      : Math.round(
          (Date.parse(range.end) - Date.parse(range.start)) / 86_400_000,
        ) + 1;

  return (
    <div>
      <div
        className="card cal-grid"
        style={{ touchAction: "none", userSelect: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        {/* Header: day numbers 1–31, one per column. */}
        <span className="cal-name" />
        {Array.from({ length: 31 }, (_, i) => (
          <span
            key={`h${i}`}
            className={i === 0 || (i + 1) % 5 === 0 ? "cal-daynum cal-daynum--tick" : "cal-daynum"}
          >
            {i + 1}
          </span>
        ))}

        {/* One row per month; every month is padded to 31 columns so the
            grid is perfectly aligned (short months get blank cells). */}
        {months.map((month) => (
          <Fragment key={month.label}>
            <span
              className="cal-name"
              style={{
                fontWeight: month.current ? 700 : 500,
                color: month.current ? "var(--color-primary)" : undefined,
              }}
            >
              {month.label}
            </span>
            {Array.from({ length: 31 }, (_, i) => {
              const day = month.days[i];
              if (!day) return <span key={i} className="cal-cell cal-cell--blank" />;
              return (
                <span
                  key={day.iso}
                  data-iso={day.iso}
                  className={`cal-cell ${day.cls} ${inSelection(day.iso) ? "cal-cell--sel" : ""}`}
                  title={day.title}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      {months[shown] && (
        <div className="card cal-month-view">
          <div className="cal-month-view__bar">
            <button
              type="button"
              className="btn-chip btn-chip--icon"
              aria-label={labels.calendar_prev_month}
              title={labels.calendar_prev_month}
              disabled={shown === 0}
              onClick={() => setShown((n) => Math.max(0, n - 1))}
            >
              <IconChevronLeft size={18} />
            </button>
            <b className={months[shown].current ? "is-current" : undefined}>{months[shown].longLabel}</b>
            <button
              type="button"
              className="btn-chip btn-chip--icon"
              aria-label={labels.calendar_next_month}
              title={labels.calendar_next_month}
              disabled={shown === months.length - 1}
              onClick={() => setShown((n) => Math.min(months.length - 1, n + 1))}
            >
              <IconChevronRight size={18} />
            </button>
          </div>
          <div className="cal-month-view__grid">
            {weekdays.map((name) => (
              <span key={name} className="cal-month-view__wd">
                {name}
              </span>
            ))}
            {/* Blank cells up to the month's first weekday (Monday first). */}
            {Array.from({ length: mondayOffset(months[shown].days[0]?.iso) }, (_, i) => (
              <span key={`b${i}`} aria-hidden />
            ))}
            {months[shown].days.map((day) => (
              <button
                key={day.iso}
                type="button"
                className={`cal-mcell cal-cell ${day.cls} ${inSelection(day.iso) ? "cal-cell--sel" : ""}${
                  day.iso === todayIso ? " is-today" : ""
                }${day.iso === tapAnchor ? " is-anchor" : ""}`}
                title={day.title}
                aria-label={day.title}
                aria-pressed={inSelection(day.iso)}
                onClick={() => onTap(day.iso)}
              >
                {Number(day.iso.slice(8))}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="hint cal-hint--drag" style={{ marginTop: 8 }}>{isDaily ? labels.drag_hint_daily : labels.drag_hint}</p>
      <p className="hint cal-hint--tap" style={{ marginTop: 8 }}>{labels.tap_hint}</p>
      {/* Saved, with a note: e.g. "not rented" over nights a contract or a
          booking holds — those stay rented until that record changes. */}
      {!range && state?.ok && state.notice && (
        <p className="alert-card alert-card--info" role="status" style={{ display: "block", fontSize: 13, marginTop: 8 }}>
          {labels[state.notice] ?? state.notice}{" "}
          {labels.notice_days_held_link && (
            <a href="#contracts" className="link">{labels.notice_days_held_link}</a>
          )}
        </p>
      )}

      {range && (
        <form
          // A second tap extends the range: the fields start again from it.
          key={`${range.start}|${range.end}`}
          action={formAction}
          // Submitted without React's form reset: an error keeps the
          // typed tenant name and amount.
          onSubmit={(event) => {
            submitted.current = true;
            keepTyped(formAction)(event);
          }}
          className="alert-card mark-form"
          style={{ marginTop: 10, alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}
        >
          <input type="hidden" name="assetId" value={assetId} />
          {/* A long let is a contract charged per month. */}
          {!isDaily && <input type="hidden" name="paymentPeriod" value="monthly" />}
          <div style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
            {labels.mark_range_title}: {nights} {labels.nights_short}
          </div>
          <label className="field" style={{ width: 150 }}>
            <span>
              {labels.contract_start}
              <Req />
            </span>
            <input type="date" name="startDate" defaultValue={range.start} required aria-required="true" />
          </label>
          <label className="field" style={{ width: 150 }}>
            <span>
              {labels.contract_end}
              <Req />
            </span>
            <input
              type="date"
              name="endDate"
              defaultValue={dayAfter(range.end)}
              min={dayAfter(range.start)}
              required
              aria-required="true"
            />
          </label>
          <label className="field" style={{ width: 130 }}>
            <span>
              {isDaily ? labels.mark_amount_night : labels.contract_amount_monthly}
              {!isDaily && <Req />}
            </span>
            <input
              type="number"
              name="amount"
              min={isDaily ? 0 : 0.01}
              step="0.01"
              defaultValue={defaultRate ?? undefined}
              required={!isDaily}
              aria-required={!isDaily || undefined}
            />
          </label>
          <label className="field" style={{ width: 170 }}>
            {isDaily ? labels.mark_note : labels.contract_tenant}
            <input name="tenantName" autoComplete="off" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="btn-primary"
              {...(isDaily ? { name: "rented", value: "1" } : {})}
            >
              {labels.mark_save}
            </button>
            {isDaily && (
              <button type="submit" name="rented" value="0" disabled={pending} className="btn-chip">
                {labels.mark_not_rented}
              </button>
            )}
            <button
              type="button"
              className="btn-chip"
              onClick={() => {
                setRange(null);
                setAnchor(null);
                setHover(null);
                setTapAnchor(null);
              }}
            >
              {labels.cancel}
            </button>
          </div>
          {state?.error && (
            <p style={{ color: "var(--status-danger-text)", fontSize: 13, width: "100%" }}>
              {labels[state.error] ?? state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
