"use client";

import { useActionState } from "react";
import { createOperator, type FormState } from "@/lib/units/actions";

const inputClass =
  "w-full rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";

export default function OnboardingForm({
  labels,
}: {
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createOperator,
    null,
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        {labels.name}
        <input name="name" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {labels.email}
        <input name="email" type="email" required className={inputClass} />
      </label>
      {state?.error && (
        <p className="text-sm text-red-600">{labels[state.error]}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {labels.submit}
      </button>
    </form>
  );
}
