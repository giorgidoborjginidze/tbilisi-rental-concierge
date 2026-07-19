"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createBooking } from "@/lib/bookings/actions";
import type { FormState } from "@/lib/units/actions";


export default function BookingForm({
  units,
  labels,
}: {
  units: { id: string; label: string }[];
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createBooking,
    null,
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <label className="field">
        {labels.booking_unit}
        <select name="unitId" required>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.label}</option>
          ))}
        </select>
      </label>

      <label className="field">
        {labels.booking_source}
        <select name="source">
          <option value="manual">{labels.source_manual}</option>
          <option value="direct">{labels.source_direct}</option>
        </select>
      </label>

      <label className="field">
        {labels.booking_guest}
        <input name="guestName" />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="field">
          {labels.booking_check_in}
          <input name="checkIn" type="date" required />
        </label>
        <label className="field">
          {labels.booking_check_out}
          <input name="checkOut" type="date" required />
        </label>
      </div>

      <label className="field">
        {labels.booking_amount}
        <input name="amount" type="number" min={0} step="0.01" />
      </label>

      {state?.error && (
        <p style={{ color: "var(--status-danger-text)", fontSize: 13 }}>{labels[state.error]}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
        >
          {labels.save}
        </button>
        <Link href="/units" className="link">
          {labels.cancel}
        </Link>
      </div>
    </form>
  );
}
