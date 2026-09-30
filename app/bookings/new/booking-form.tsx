"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createBooking } from "@/lib/bookings/actions";
import type { FormState } from "@/lib/units/actions";


export default function BookingForm({
  units,
  labels,
  defaultUnitId,
}: {
  units: { id: string; label: string }[];
  labels: Record<string, string>;
  /** Preselected unit (from ?unit= on the calendar). */
  defaultUnitId?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createBooking,
    null,
  );
  // After an error the fields show what was submitted (React resets the
  // form after its action; a clash must not wipe the dates and the guest).
  const sent = state && "values" in state ? state.values : undefined;

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <label className="field">
        {labels.booking_unit}
        <select name="unitId" required defaultValue={sent?.unitId ?? defaultUnitId}>
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
          {labels.booking_check_in}
          <input name="checkIn" type="date" required defaultValue={sent?.checkIn ?? ""} />
        </label>
        <label className="field">
          {labels.booking_check_out}
          <input name="checkOut" type="date" required defaultValue={sent?.checkOut ?? ""} />
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
