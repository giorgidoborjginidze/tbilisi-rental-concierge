"use client";

import { useActionState } from "react";
import { addIncome } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";


export default function IncomeForm({ labels }: { labels: Record<string, string> }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addIncome,
    null,
  );

  return (
    <form
      action={formAction}
      className="card form-grid form-grid--full h-fit" style={{ padding: 18, overflow: "visible" }}
    >
      <label className="field">
        {labels.income_source}
        <select name="source">
          <option value="salary">{labels.source_salary}</option>
          <option value="business">{labels.source_business}</option>
          <option value="dividend">{labels.source_dividend}</option>
          <option value="other">{labels.source_other}</option>
        </select>
      </label>
      <label className="field">
        {labels.income_date}
        <input name="date" type="date" required />
      </label>
      <label className="field">
        {labels.income_amount}
        <input name="amount" type="number" min={0} step="0.01" required />
      </label>
      <label className="field">
        {labels.income_desc}
        <input name="description" />
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
          {labels.income_add}
        </button>
      </div>
    </form>
  );
}
