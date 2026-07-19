"use client";

import { useActionState } from "react";
import { saveContract } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";

const inputClass =
  "w-full rounded border border-line-strong bg-white px-3 py-2 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

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
      className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-white p-4 shadow-card"
    >
      <input type="hidden" name="assetId" value={assetId} />
      <label className={labelClass}>
        {labels.contract_tenant}
        <input name="tenantName" className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.tenant_phone}
        <input name="tenantPhone" type="tel" placeholder="+995 5XX XX XX XX" className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.contract_rent}
        <input name="monthlyRent" type="number" min={1} step="0.01" required className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.contract_start}
        <input name="startDate" type="date" required className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.contract_end}
        <input name="endDate" type="date" required className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.contract_deposit}
        <input name="deposit" type="number" min={0} step="0.01" className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.asset_notes}
        <input name="notes" className={inputClass} />
      </label>
      {state?.error && (
        <p className="col-span-2 text-sm text-red-600">{labels[state.error]}</p>
      )}
      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-card hover:bg-primary-dark disabled:opacity-50"
        >
          {labels.contract_add}
        </button>
      </div>
    </form>
  );
}
