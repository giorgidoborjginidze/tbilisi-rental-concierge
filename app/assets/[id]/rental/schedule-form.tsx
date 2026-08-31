"use client";

import { useActionState } from "react";
import { saveSchedule, recordPayment } from "@/lib/rentals/actions";
import type { FormState } from "@/lib/units/actions";

export interface ScheduleDefaults {
  paymentPeriod: string;
  paymentAmount: string;
  graceDays: string;
  paidThrough: string;
}

// The payment terms of one contract, plus the box for recording money
// received. Both write through server actions and re-render the status
// panel above them.
export default function ScheduleForm({
  assetId,
  contractId,
  currency,
  defaults,
  labels,
}: {
  assetId: string;
  contractId: string;
  currency: string;
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

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rental-two">
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
            min={1}
            step="0.01"
            defaultValue={defaults.paymentAmount}
            placeholder={labels.pay_amount_hint}
          />
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
          <input name="paidThrough" type="date" defaultValue={defaults.paidThrough} />
        </label>

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

      <form action={pay} className="card form-grid" style={{ padding: 18 }}>
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="contractId" value={contractId} />

        <h3 className="col-span-2" style={{ margin: 0, fontSize: 15 }}>
          {labels.pay_record}
        </h3>

        <label className="field">
          {labels.pay_received} ({currency})
          <input name="amount" type="number" min={1} step="0.01" required />
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
    </div>
  );
}
