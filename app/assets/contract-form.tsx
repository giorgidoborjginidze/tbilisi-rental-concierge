"use client";

import { useActionState } from "react";
import { saveContract } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";

const inputClass =
  "w-full rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";
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
      className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <input type="hidden" name="assetId" value={assetId} />
      <label className={labelClass}>
        {labels.contract_tenant}
        <input name="tenantName" className={inputClass} />
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
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {labels.contract_add}
        </button>
      </div>
    </form>
  );
}
