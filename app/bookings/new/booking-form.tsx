"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createBooking } from "@/lib/bookings/actions";
import type { FormState } from "@/lib/units/actions";

const inputClass =
  "w-full rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";
const labelClass = "flex flex-col gap-1 text-sm";

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
      <label className={labelClass}>
        {labels.booking_unit}
        <select name="unitId" required className={inputClass}>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.label}</option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        {labels.booking_source}
        <select name="source" className={inputClass}>
          <option value="manual">{labels.source_manual}</option>
          <option value="direct">{labels.source_direct}</option>
        </select>
      </label>

      <label className={labelClass}>
        {labels.booking_guest}
        <input name="guestName" className={inputClass} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={labelClass}>
          {labels.booking_check_in}
          <input name="checkIn" type="date" required className={inputClass} />
        </label>
        <label className={labelClass}>
          {labels.booking_check_out}
          <input name="checkOut" type="date" required className={inputClass} />
        </label>
      </div>

      <label className={labelClass}>
        {labels.booking_amount}
        <input name="amount" type="number" min={0} step="0.01" className={inputClass} />
      </label>

      {state?.error && (
        <p className="text-sm text-red-600">{labels[state.error]}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {labels.save}
        </button>
        <Link href="/units" className="text-sm text-neutral-500 hover:underline">
          {labels.cancel}
        </Link>
      </div>
    </form>
  );
}
