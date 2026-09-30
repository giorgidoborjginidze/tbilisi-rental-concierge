"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword } from "@/lib/auth/actions";
import type { FormState } from "@/lib/units/actions";

export default function ResetForm({ token, labels }: { token: string; labels: Record<string, string> }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(resetPassword, null);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="field">
        {labels.password}
        <input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </label>
      <label className="field">
        {labels.repeat}
        <input name="repeat" type="password" required minLength={8} autoComplete="new-password" />
      </label>
      {state?.error && (
        <p style={{ color: "var(--status-danger-text)", fontSize: 13 }} role="alert">
          {labels[state.error] ?? labels.reset_invalid}
          {state.error === "reset_invalid" && (
            <>
              {" "}
              <Link href="/forgot" className="link">{labels.forgot_link}</Link>
            </>
          )}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {labels.submit}
      </button>
    </form>
  );
}
