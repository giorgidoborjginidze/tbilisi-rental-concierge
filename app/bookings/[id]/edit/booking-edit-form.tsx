"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { cancelBooking, restoreBooking, updateBooking } from "@/lib/bookings/actions";
import ConfirmAction from "@/app/confirm-action";
import { currencySign } from "@/lib/format";
import type { FormState } from "@/lib/units/actions";
import { keepTyped } from "@/app/keep-typed";
import { Req, RequiredLegend } from "@/app/form-bits";
import { addDaysKey } from "@/lib/time";

export interface EditableBooking {
  id: string;
  guestName: string;
  amount: string;
  checkIn: string;
  checkOut: string;
  currency: string;
}


export default function BookingEditForm({
  booking,
  labels,
  datesEditable,
  cancelled,
  backHref,
}: {
  booking: EditableBooking;
  labels: Record<string, string>;
  datesEditable: boolean;
  cancelled: boolean;
  /** Where Save and Cancel lead: the bookings list or the unit's calendar. */
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateBooking, null);
  const [restoreState, restoreAction, restoring] = useActionState<FormState, FormData>(
    restoreBooking,
    null,
  );
  // After an error the fields show what was submitted (React resets the form).
  const sent = state && "values" in state ? state.values : undefined;
  const val = (name: keyof EditableBooking) => (sent ? (sent[name] ?? "") : booking[name]);
  const error = state?.error ? state : restoreState?.error ? restoreState : null;
  // Check-out is at least the night after check-in.
  const [checkIn, setCheckIn] = useState(val("checkIn"));
  const minCheckOut = addDaysKey(checkIn, 1);

  return (
    <>
      <form action={formAction} onSubmit={keepTyped(formAction)} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="bookingId" value={booking.id} />
        <input type="hidden" name="back" value={backHref} />
        <label className="field">
          {labels.booking_amount_total} ({currencySign(booking.currency)})
          <input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            defaultValue={val("amount")}
            autoFocus={booking.amount === ""}
          />
        </label>
        <label className="field">
          {labels.booking_guest}
          <input name="guestName" defaultValue={val("guestName")} />
        </label>
        {datesEditable && (
          <div className="grid grid-cols-2 gap-4">
            <RequiredLegend text={labels.form_required_legend} />
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
                defaultValue={val("checkIn")}
                onChange={(event) => setCheckIn(event.currentTarget.value)}
              />
            </label>
            <label className="field">
              <span>
                {labels.booking_check_out}
                <Req />
              </span>
              <input
                name="checkOut"
                type="date"
                required
                aria-required="true"
                min={minCheckOut}
                defaultValue={val("checkOut")}
              />
            </label>
          </div>
        )}

        {error?.error && (
          <p className="form-error" role="alert">
            {labels[error.error]}
            {error.detail ? ` ${error.detail}` : ""}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="btn-primary">
            {labels.save}
          </button>
          <Link href={backHref} className="link">
            {labels.cancel}
          </Link>
        </div>
      </form>

      <div className="mt-6" style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
        {cancelled ? (
          <form action={restoreAction}>
            <input type="hidden" name="bookingId" value={booking.id} />
            <button type="submit" className="btn-secondary" disabled={restoring}>
              {labels.booking_restore}
            </button>
          </form>
        ) : (
          <ConfirmAction
            action={cancelBooking}
            fields={{ bookingId: booking.id }}
            trigger={labels.booking_cancel_stay}
            triggerClassName="btn-danger"
            question={labels.booking_cancel_confirm}
            confirmLabel={labels.booking_cancel_stay}
            cancelLabel={labels.cancel}
          />
        )}
      </div>
    </>
  );
}
