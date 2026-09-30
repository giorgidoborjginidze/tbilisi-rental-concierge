"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/auth/actions";
import type { FormState } from "@/lib/units/actions";

export default function ForgotForm({ labels }: { labels: Record<string, string> }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(requestPasswordReset, null);
  const sent = state && "values" in state ? state.values : undefined;

  if (state && "ok" in state && state.ok) {
    return (
      <p className="demo-hint" role="status" style={{ marginTop: 18 }}>
        {labels.sent}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <label className="field">
        {labels.email}
        <input name="email" type="email" required autoComplete="email" defaultValue={sent?.email ?? ""} />
      </label>
      {state?.error && (
        <p style={{ color: "var(--status-danger-text)", fontSize: 13 }} role="alert">
          {labels[state.error] ?? labels.error_email_invalid}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {labels.submit}
      </button>
    </form>
  );
}
