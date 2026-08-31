"use client";

import { useActionState } from "react";
import { saveContract } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";


export default function ContractForm({
  assetId,
  labels,
}: {
  assetId: string;
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveContract,
    null,
  );

  return (
    <form
      action={formAction}
      className="card form-grid form-grid--full" style={{ padding: 18, overflow: "visible" }}
    >
      <input type="hidden" name="assetId" value={assetId} />
      <label className="field">
        {labels.contract_tenant}
        <input name="tenantName" />
      </label>
      <label className="field">
        {labels.tenant_phone}
        <input name="tenantPhone" type="tel" placeholder="+995 5XX XX XX XX" />
      </label>
      <label className="field">
        {labels.contract_rent}
        <input name="monthlyRent" type="number" min={1} step="0.01" required />
      </label>
      <label className="field">
        {labels.contract_start}
        <input name="startDate" type="date" required />
      </label>
      <label className="field">
        {labels.contract_end}
        <input name="endDate" type="date" required />
      </label>
      <label className="field">
        {labels.contract_deposit}
        <input name="deposit" type="number" min={0} step="0.01" />
      </label>
      {/* Payment terms travel with the contract from the start, so a car
          rental is watched from day one rather than after a second edit. */}
      <label className="field">
        {labels.pay_period}
        <select name="paymentPeriod" defaultValue="monthly">
          <option value="daily">{labels.period_daily}</option>
          <option value="weekly">{labels.period_weekly}</option>
          <option value="monthly">{labels.period_monthly}</option>
        </select>
      </label>
      <label className="field">
        {labels.pay_grace}
        <input name="graceDays" type="number" min={0} max={60} step={1} defaultValue={3} />
      </label>
      <label className="field">
        {labels.asset_notes}
        <input name="notes" />
      </label>
      {state?.error && (
        <p className="col-span-2" style={{ color: "var(--status-danger-text)", fontSize: 13 }}>{labels[state.error]}</p>
      )}
      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
        >
          {labels.contract_add}
        </button>
      </div>
    </form>
  );
}
