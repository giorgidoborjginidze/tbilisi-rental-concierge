"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      {mode === "register" && (
        <label className="field">
          {labels.operator_name_optional}
          <input name="name" autoComplete="off" />
          <span className="hint">{labels.operator_name_hint}</span>
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
              <input
                type="radio"
                name="accountType"
                value="personal"
                checked={accountType === "personal"}
                onChange={() => setAccountType("personal")}
                style={{ marginRight: 6 }}
              />
              {labels.account_personal}
            </label>
            <label className="btn-chip" style={{ cursor: "pointer" }}>
              <input
                type="radio"
                name="accountType"
                value="business"
                checked={accountType === "business"}
                onChange={() => setAccountType("business")}
                style={{ marginRight: 6 }}
              />
              {labels.account_business}
            </label>
          </div>
        </div>
      )}
      {mode === "register" && !invite && accountType === "business" && (
        <div className="field">
          {labels.profile_label}
          <div className="flex flex-wrap gap-1.5">
            <label className="btn-chip" style={{ cursor: "pointer" }}>
              <input type="radio" name="profile" value="hotel" defaultChecked style={{ marginRight: 6 }} />
              🏨 {labels.profile_hotel}
            </label>
            <label className="btn-chip" style={{ cursor: "pointer" }}>
              <input type="radio" name="profile" value="brokerage" style={{ marginRight: 6 }} />
              🏢 {labels.profile_brokerage}
            </label>
          </div>
          <span className="hint">{labels.profile_hint}</span>
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
