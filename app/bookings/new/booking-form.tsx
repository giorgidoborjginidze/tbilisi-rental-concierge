"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createBooking } from "@/lib/bookings/actions";
import type { FormState } from "@/lib/units/actions";
import { Req, RequiredLegend } from "@/app/form-bits";
import { keepTyped } from "@/app/keep-typed";
import { addDaysKey } from "@/lib/time";

/** "YYYY-MM-DD" of the next day. */
const dayAfter = (key: string) => addDaysKey(key, 1);


export default function BookingForm({
  units,
  labels,
  defaultUnitId,
  defaultCheckIn,
}: {
  units: { id: string; label: string }[];
  labels: Record<string, string>;
  /** Preselected unit (from ?unit= on the calendar). */
  defaultUnitId?: string;
  /** The free night tapped on the calendar ("YYYY-MM-DD"): check-in, one night. */
  defaultCheckIn?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createBooking,
    null,
  );
  // After an error the fields show what was submitted (React resets the
  // form after its action; a clash must not wipe the dates and the guest).
  const sent = state && "values" in state ? state.values : undefined;
  const [checkIn, setCheckIn] = useState(sent?.checkIn ?? defaultCheckIn ?? "");

  return (
    <form action={formAction} onSubmit={keepTyped(formAction)} className="mt-6 flex flex-col gap-4">
      <RequiredLegend text={labels.form_required_legend} />
      <label className="field">
        <span>
          {labels.booking_unit}
          <Req />
        </span>
        <select name="unitId" required aria-required="true" defaultValue={sent?.unitId ?? defaultUnitId}>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.label}</option>
          ))}
        </select>
      </label>

      <label className="field">
        {labels.booking_source}
        <select name="source" defaultValue={sent?.source ?? "manual"}>
          <option value="manual">{labels.source_manual}</option>
          <option value="direct">{labels.source_direct}</option>
        </select>
      </label>

      <label className="field">
        {labels.booking_guest}
        <input name="guestName" defaultValue={sent?.guestName ?? ""} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="field">
          <span>
            {labels.booking_check_in}
            <Req />
          </span>
          <input
            name="checkIn"
            type="date"
            required
            aria-required="true"
            defaultValue={sent?.checkIn ?? defaultCheckIn ?? ""}
            onChange={(event) => setCheckIn(event.target.value)}
          />
        </label>
        <label className="field">
          <span>
            {labels.booking_check_out}
            <Req />
          </span>
          {/* The day after check-in at the earliest: the browser says so
              before anything is sent. */}
          <input
            name="checkOut"
            type="date"
            required
            aria-required="true"
            min={checkIn ? dayAfter(checkIn) : undefined}
            defaultValue={sent?.checkOut ?? (defaultCheckIn ? dayAfter(defaultCheckIn) : undefined) ?? ""}
          />
        </label>
      </div>

      <label className="field">
        {labels.booking_amount}
        <input
          name="amount"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          defaultValue={sent?.amount ?? ""}
        />
      </label>

      {state?.error && (
        <p className="form-error" role="alert">
          {labels[state.error]}
          {state.detail ? ` ${state.detail}` : ""}
        </p>
      )}
      {state?.error === "error_booking_closed_block" && (
        // The owner answers the question; the next save goes through.
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" name="confirmBlock" value="1" required />
          {labels.booking_block_confirm}
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
        >
          {labels.save}
        </button>
        <Link href="/bookings" className="link">
          {labels.cancel}
        </Link>
      </div>
    </form>
  );
}
