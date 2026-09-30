"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveSchedule, recordPayment } from "@/lib/rentals/actions";
import type { FormState } from "@/lib/units/actions";
import { currencySign } from "@/lib/format";
import { todayKey } from "@/lib/time";
import { keepingValues } from "@/lib/forms";
import { FormMessage } from "@/app/form-bits";
import { keepTyped } from "@/app/keep-typed";

export interface ScheduleDefaults {
  paymentPeriod: string;
  paymentAmount: string;
  graceDays: string;
  paidThrough: string;
  remindersEnabled: boolean;
}

// The payment terms of one contract, plus the box for recording money
// received. Both write through server actions and re-render the status
// panel above them. Money can only be recorded once the schedule has a
// starting point ("Rent paid up to").
export default function ScheduleForm({
  assetId,
  contractId,
  currency,
  tracked,
  payOnly = false,
  defaults,
  labels,
}: {
  assetId: string;
  contractId: string;
  currency: string;
  tracked: boolean;
  /** Only the "money received" box — for a finished contract's balance. */
  payOnly?: boolean;
  defaults: ScheduleDefaults;
  labels: Record<string, string>;
}) {
  // An error keeps what was typed; a save says so.
  const [termsState, saveTerms, savingTerms] = useActionState<FormState, FormData>(
    keepingValues(saveSchedule),
    null,
  );
  const [payState, pay, paying] = useActionState<FormState, FormData>(
    keepingValues(recordPayment),
    null,
  );
  const terms = termsState && "values" in termsState ? termsState.values : undefined;
  const paid = payState && "values" in payState ? payState.values : undefined;
  // A recorded payment clears the box (the form is not reset by itself:
  // keepTyped keeps what was typed after an error).
  const payForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (payState?.ok) payForm.current?.reset();
  }, [payState]);

  // Today in Tbilisi — after midnight there it is already the next day.
  const today = todayKey();

  return (
    <div className="rental-two">
      {!payOnly && (
      <form action={saveTerms} onSubmit={keepTyped(saveTerms)} className="card form-grid" style={{ padding: 18 }}>
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="contractId" value={contractId} />

        <label className="field">
          {labels.pay_period}
          <select name="paymentPeriod" defaultValue={terms?.paymentPeriod ?? defaults.paymentPeriod}>
            <option value="daily">{labels.period_daily}</option>
            <option value="weekly">{labels.period_weekly}</option>
            <option value="monthly">{labels.period_monthly}</option>
          </select>
        </label>

        <label className="field">
          {labels.pay_amount} ({currencySign(currency)})
          <input
            name="paymentAmount"
            type="number"
            min={0.01}
            step="0.01"
            defaultValue={terms?.paymentAmount ?? defaults.paymentAmount}
            required
            aria-required="true"
          />
          <span className="hint">{labels.pay_amount_hint}</span>
        </label>

        <label className="field">
          {labels.pay_grace}
          <input
            name="graceDays"
            type="number"
            min={0}
            max={60}
            step={1}
            defaultValue={terms?.graceDays ?? defaults.graceDays}
            required
            aria-required="true"
          />
        </label>

        <label className="field">
          {labels.pay_paid_through}
          <input
            name="paidThrough"
            type="date"
            defaultValue={terms?.paidThrough ?? defaults.paidThrough}
            required
            aria-required="true"
          />
          {/* What the page showed: the balance is restated only when the
              owner actually changed the date, never because the page was
              stale or the period grid moved. */}
          <input type="hidden" name="paidThroughWas" value={defaults.paidThrough} />
        </label>

        <label
          className="field col-span-2"
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <input type="hidden" name="remindersField" value="1" />
          <input
            type="checkbox"
            name="remindersEnabled"
            defaultChecked={defaults.remindersEnabled}
          />
          {labels.contract_reminders}
        </label>

        <p className="field-hint col-span-2">{labels.pay_paid_through_hint}</p>
        <p className="field-hint col-span-2">{labels.pay_grace_hint}</p>

        <div className="col-span-2 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={savingTerms}>
            {labels.save}
          </button>
          <FormMessage
            error={termsState?.error ? labels[termsState.error] ?? termsState.error : null}
            saved={termsState?.ok ? labels.saved_short : null}
          />
        </div>
      </form>
      )}

      {tracked && (
      <form ref={payForm} action={pay} onSubmit={keepTyped(pay)} className="card form-grid" style={{ padding: 18 }}>
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="contractId" value={contractId} />

        <h3 className="col-span-2" style={{ margin: 0, fontSize: 15 }}>
          {labels.pay_record}
        </h3>

        <label className="field">
          {labels.pay_received} ({currencySign(currency)})
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            required
            aria-required="true"
            defaultValue={paid?.amount}
          />
        </label>

        <label className="field">
          {labels.pay_date}
          <input name="paidAt" type="date" max={today} defaultValue={paid?.paidAt ?? today} />
        </label>

        <label className="field">
          {labels.pay_method}
          <select name="method" defaultValue={paid?.method ?? "cash"}>
            <option value="cash">{labels.method_cash}</option>
            <option value="transfer">{labels.method_transfer}</option>
            <option value="card">{labels.method_card}</option>
            <option value="other">{labels.method_other}</option>
          </select>
        </label>

        <label className="field">
          {labels.pay_note}
          <input name="note" defaultValue={paid?.note} />
        </label>

        <p className="field-hint col-span-2">{labels.pay_partial_hint}</p>

        <div className="col-span-2 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={paying}>
            {labels.pay_record}
          </button>
          <FormMessage
            error={payState?.error ? labels[payState.error] ?? payState.error : null}
            saved={payState?.ok ? labels.pay_recorded : null}
          />
        </div>
      </form>
      )}
    </div>
  );
}
