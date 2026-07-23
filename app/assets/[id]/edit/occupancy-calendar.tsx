"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { saveContract } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";

export interface CalDay {
  iso: string; // "YYYY-MM-DD"
  cls: string;
  title: string;
}
export interface CalMonth {
  label: string;
  current: boolean;
  days: CalDay[];
}

// Per-asset occupancy calendar with drag-to-mark: swipe across days to
// select a range, then save it as a rental contract (dates + price
// prefilled). Pointer events cover mouse and touch alike.
export default function OccupancyCalendar({
  assetId,
  months,
  defaultRate,
  isDaily,
  labels,
}: {
  assetId: string;
  months: CalMonth[];
  /** Prefill for the price field: daily rate or last monthly rent. */
  defaultRate: number | null;
  isDaily: boolean;
  labels: Record<string, string>;
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
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveContract,
    null,
  );

  // A successful save refreshes the server data; clear the selection.
  useEffect(() => {
    if (submitted.current && !pending && !state?.error) {
      submitted.current = false;
      setRange(null);
      setAnchor(null);
      setHover(null);
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

  const selStart = range?.start ?? (anchor && hover ? [anchor, hover].sort()[0] : null);
  const selEnd = range?.end ?? (anchor && hover ? [anchor, hover].sort()[1] : null);
  const inSelection = (iso: string) =>
    selStart != null && selEnd != null && iso >= selStart && iso <= selEnd;

  // Checkout convention: the contract ends the day AFTER the last
  // selected night (same as booking check-out).
  const dayAfter = (iso: string) => {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  };

  const nights =
    range == null
      ? 0
      : Math.round(
          (Date.parse(range.end) - Date.parse(range.start)) / 86_400_000,
        ) + 1;

  return (
    <div>
      <div
        className="card"
        style={{ padding: "12px 16px", touchAction: "none", userSelect: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        {/* Day-number header, aligned with the columns below. */}
        <div className="cal-row cal-row--head">
          <span className="cal-name" />
          {Array.from(
            { length: Math.max(0, ...months.map((m) => m.days.length)) },
            (_, i) => {
              const d = i + 1;
              return (
                <span key={i} className="cal-daynum">
                  {d === 1 || d % 5 === 0 ? d : ""}
                </span>
              );
            },
          )}
        </div>
        {months.map((month) => (
          <div key={month.label} className="cal-row">
            <span
              className="cal-name"
              style={{
                fontWeight: month.current ? 700 : 500,
                color: month.current ? "var(--color-primary)" : undefined,
              }}
            >
              {month.label}
            </span>
            {month.days.map((day) => (
              <span
                key={day.iso}
                data-iso={day.iso}
                className={`cal-cell ${day.cls} ${inSelection(day.iso) ? "cal-cell--sel" : ""}`}
                title={day.title}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 8 }}>{labels.drag_hint}</p>

      {range && (
        <form
          action={formAction}
          onSubmit={() => {
            submitted.current = true;
          }}
          className="alert-card"
          style={{ marginTop: 10, alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}
        >
          <input type="hidden" name="assetId" value={assetId} />
          <div style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
            {labels.mark_range_title}: {nights} {labels.nights_short}
          </div>
          <label className="field" style={{ width: 150 }}>
            {labels.contract_start}
            <input type="date" name="startDate" defaultValue={range.start} required />
          </label>
          <label className="field" style={{ width: 150 }}>
            {labels.contract_end}
            <input type="date" name="endDate" defaultValue={dayAfter(range.end)} required />
          </label>
          <label className="field" style={{ width: 130 }}>
            {isDaily ? labels.daily_rate : labels.contract_rent}
            <input
              type="number"
              name="monthlyRent"
              min={1}
              defaultValue={defaultRate ?? undefined}
              required
            />
          </label>
          <label className="field" style={{ width: 170 }}>
            {labels.contract_tenant}
            <input name="tenantName" autoComplete="off" />
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {labels.mark_save}
            </button>
            <button
              type="button"
              className="btn-chip"
              onClick={() => {
                setRange(null);
                setAnchor(null);
                setHover(null);
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
