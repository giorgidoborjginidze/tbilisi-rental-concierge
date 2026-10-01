"use client";

import { useActionState, useEffect, useRef } from "react";
import { addIncome } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";
import { FormMessage, Req } from "@/app/form-bits";
import { keepTyped } from "@/app/keep-typed";


export default function IncomeForm({ labels }: { labels: Record<string, string> }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addIncome,
    null,
  );
  // An error keeps what was typed.
  const sent = state && "values" in state ? state.values : undefined;
  // A saved entry clears the form; an error keeps what was typed.
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={keepTyped(formAction)}
      className="card form-grid form-grid--full h-fit" style={{ padding: 18, overflow: "visible" }}
    >
      <label className="field">
        {labels.income_source}
        <select name="source" defaultValue={sent?.source ?? "salary"}>
          <option value="salary">{labels.source_salary}</option>
          <option value="business">{labels.source_business}</option>
          <option value="dividend">{labels.source_dividend}</option>
          <option value="other">{labels.source_other}</option>
        </select>
      </label>
      <label className="field">
        <span>
          {labels.income_date}
          <Req />
        </span>
        <input name="date" type="date" required aria-required="true" defaultValue={sent?.date} />
      </label>
      <label className="field">
        <span>
          {labels.income_amount}
          <Req />
        </span>
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          required
          aria-required="true"
          defaultValue={sent?.amount}
        />
      </label>
      <label className="field">
        {labels.contract_currency}
        <select name="currency" defaultValue={sent?.currency ?? "GEL"}>
          <option value="GEL">₾ GEL</option>
          <option value="USD">$ USD</option>
          <option value="EUR">€ EUR</option>
        </select>
      </label>
      <label className="field">
        {labels.income_desc}
        <input name="description" defaultValue={sent?.description} />
      </label>
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
        >
          {labels.income_add}
        </button>
        <FormMessage
          error={state?.error ? labels[state.error] ?? state.error : null}
          saved={state?.ok ? labels.saved_short : null}
        />
      </div>
    </form>
  );
}
