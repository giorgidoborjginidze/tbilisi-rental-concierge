"use client";

import { useActionState } from "react";
import { saveSchedule, recordPayment } from "@/lib/rentals/actions";
import type { FormState } from "@/lib/units/actions";
import { todayKey } from "@/lib/time";

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
  const [termsState, saveTerms, savingTerms] = useActionState<FormState, FormData>(
    saveSchedule,
    null,
  );
  const [payState, pay, paying] = useActionState<FormState, FormData>(
    recordPayment,
    null,
  );

  // Today in Tbilisi — after midnight there it is already the next day.
  const today = todayKey();

  return (
    <div className="rental-two">
      {!payOnly && (
      <form action={saveTerms} className="card form-grid" style={{ padding: 18 }}>
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="contractId" value={contractId} />

        <label className="field">
          {labels.pay_period}
          <select name="paymentPeriod" defaultValue={defaults.paymentPeriod}>
            <option value="daily">{labels.period_daily}</option>
            <option value="weekly">{labels.period_weekly}</option>
            <option value="monthly">{labels.period_monthly}</option>
          </select>
        </label>

        <label className="field">
          {labels.pay_amount} ({currency})
          <input
            name="paymentAmount"
            type="number"
            min={0.01}
            step="0.01"
            defaultValue={defaults.paymentAmount}
            required
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
            defaultValue={defaults.graceDays}
            required
          />
        </label>

        <label className="field">
          {labels.pay_paid_through}
          <input
            name="paidThrough"
            type="date"
            defaultValue={defaults.paidThrough}
            required
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

        {termsState?.error && (
          <p className="form-error col-span-2">{labels[termsState.error]}</p>
        )}
        <div className="col-span-2">
          <button type="submit" className="btn-primary" disabled={savingTerms}>
            {labels.save}
          </button>
        </div>
      </form>
      )}

      {tracked && (
      <form action={pay} className="card form-grid" style={{ padding: 18 }}>
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="contractId" value={contractId} />

        <h3 className="col-span-2" style={{ margin: 0, fontSize: 15 }}>
          {labels.pay_record}
        </h3>

        <label className="field">
          {labels.pay_received} ({currency})
          <input name="amount" type="number" min={0.01} step="0.01" required />
        </label>

        <label className="field">
          {labels.pay_date}
          <input name="paidAt" type="date" defaultValue={today} />
        </label>

        <label className="field">
          {labels.pay_method}
          <select name="method" defaultValue="cash">
            <option value="cash">{labels.method_cash}</option>
            <option value="transfer">{labels.method_transfer}</option>
            <option value="card">{labels.method_card}</option>
            <option value="other">{labels.method_other}</option>
          </select>
        </label>

        <label className="field">
          {labels.pay_note}
          <input name="note" />
        </label>

        <p className="field-hint col-span-2">{labels.pay_partial_hint}</p>

        {payState?.error && (
          <p className="form-error col-span-2">{labels[payState.error]}</p>
        )}
        <div className="col-span-2">
          <button type="submit" className="btn-primary" disabled={paying}>
            {labels.pay_record}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
