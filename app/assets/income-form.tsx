"use client";

import { useActionState } from "react";
import { addIncome } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";

const inputClass =
  "w-full rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";
const labelClass = "flex flex-col gap-1 text-sm";

export default function IncomeForm({ labels }: { labels: Record<string, string> }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addIncome,
    null,
  );

  return (
    <form
      action={formAction}
      className="grid h-fit grid-cols-2 gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <label className={labelClass}>
        {labels.income_source}
        <select name="source" className={inputClass}>
          <option value="salary">{labels.source_salary}</option>
          <option value="business">{labels.source_business}</option>
          <option value="dividend">{labels.source_dividend}</option>
          <option value="other">{labels.source_other}</option>
        </select>
      </label>
      <label className={labelClass}>
        {labels.income_date}
        <input name="date" type="date" required className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.income_amount}
        <input name="amount" type="number" min={0} step="0.01" required className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.income_desc}
        <input name="description" className={inputClass} />
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
          {labels.income_add}
        </button>
      </div>
    </form>
  );
}
