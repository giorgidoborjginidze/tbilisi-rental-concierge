"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/lib/auth/actions";
import type { FormState } from "@/lib/units/actions";


export default function AuthForm({
  mode,
  labels,
  invite,
}: {
  mode: "login" | "register";
  labels: Record<string, string>;
  /** Team invite token (register mode): joins the inviter's company. */
  invite?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    mode === "login" ? login : register,
    null,
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      {mode === "register" && (
        <label className="field">
          {labels.operator_name}
          <input name="name" required />
        </label>
      )}
      {mode === "register" && invite && (
        <>
          <input type="hidden" name="invite" value={invite} />
          <p className="demo-hint" style={{ margin: 0 }}>{labels.invited_to_company}</p>
        </>
      )}
      {mode === "register" && !invite && (
        <div className="field">
          {labels.account_type}
          <div className="flex gap-1.5">
            <label className="btn-chip" style={{ cursor: "pointer" }}>
              <input type="radio" name="accountType" value="personal" defaultChecked style={{ marginRight: 6 }} />
              {labels.account_personal}
            </label>
            <label className="btn-chip" style={{ cursor: "pointer" }}>
              <input type="radio" name="accountType" value="business" style={{ marginRight: 6 }} />
              {labels.account_business}
            </label>
          </div>
        </div>
      )}
      <label className="field">
        {labels.operator_email}
        <input name="email" type="email" required />
      </label>
      <label className="field">
        {labels.password_label}
        <input
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 8 : 1}
         
        />
      </label>

      {state?.error && (
        <p style={{ color: "var(--status-danger-text)", fontSize: 13 }}>{labels[state.error]}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary"
      >
        {mode === "login" ? labels.login_submit : labels.register_submit}
      </button>

      <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
        {mode === "login" ? (
          <>
            {labels.auth_no_account}{" "}
            <Link href="/register" className="link">
              {labels.register_title}
            </Link>
          </>
        ) : (
          <>
            {labels.auth_have_account}{" "}
            <Link href="/login" className="link">
              {labels.login_title}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
