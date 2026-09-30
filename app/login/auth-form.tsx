"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { login, register } from "@/lib/auth/actions";
import type { FormState } from "@/lib/units/actions";
import { keepTyped } from "@/app/keep-typed";


export default function AuthForm({
  mode,
  labels,
  invite,
  inviteEmail,
}: {
  mode: "login" | "register";
  labels: Record<string, string>;
  /** Team invite token (register mode): joins the inviter's company. */
  invite?: string;
  /** The email the invite was made for — the only one it works with. */
  inviteEmail?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    mode === "login" ? login : register,
    null,
  );
  // React resets the form after the action; what was typed comes back with
  // an error (never the password).
  const sent = state && "values" in state ? state.values : undefined;
  const [accountType, setAccountType] = useState<"personal" | "business">(
    sent?.accountType === "business" ? "business" : "personal",
  );
  const sentProfile = sent?.profile ?? "hotel";
  // The form is submitted without React's reset (keepTyped: the account
  // type radios are controlled, and a reset would clear them); only the
  // password is emptied after an error.
  const password = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state?.error && password.current) password.current.value = "";
  }, [state]);

  return (
    <form action={formAction} onSubmit={keepTyped(formAction)} className="mt-6 flex flex-col gap-4">
      {mode === "register" && (
        <label className="field">
          {labels.operator_name_optional}
          <input name="name" autoComplete="off" defaultValue={sent?.name ?? ""} />
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
            <label className="btn-chip btn-chip--select" style={{ cursor: "pointer" }}>
              <input
                type="radio"
                name="accountType"
                value="personal"
                checked={accountType === "personal"}
                onChange={() => setAccountType("personal")}
              />
              <span>{labels.account_personal}</span>
            </label>
            <label className="btn-chip btn-chip--select" style={{ cursor: "pointer" }}>
              <input
                type="radio"
                name="accountType"
                value="business"
                checked={accountType === "business"}
                onChange={() => setAccountType("business")}
              />
              <span>{labels.account_business}</span>
            </label>
          </div>
        </div>
      )}
      {mode === "register" && !invite && accountType === "business" && (
        <div className="field">
          {labels.profile_label}
          <div className="flex flex-col items-start gap-1.5">
            <label className="btn-chip btn-chip--select" style={{ cursor: "pointer" }}>
              <input type="radio" name="profile" value="hotel" defaultChecked={sentProfile === "hotel"} />
              <span>{labels.profile_hotel}</span>
            </label>
            <label className="btn-chip btn-chip--select" style={{ cursor: "pointer" }}>
              <input type="radio" name="profile" value="brokerage" defaultChecked={sentProfile === "brokerage"} />
              <span>{labels.profile_brokerage}</span>
            </label>
            <label className="btn-chip btn-chip--select" style={{ cursor: "pointer" }}>
              <input type="radio" name="profile" value="car_rental" defaultChecked={sentProfile === "car_rental"} />
              <span>{labels.profile_car}</span>
            </label>
          </div>
          <span className="hint">{labels.profile_hint}</span>
        </div>
      )}
      <label className="field">
        {labels.operator_email}
        {inviteEmail ? (
          <>
            <input name="email" type="email" value={inviteEmail} readOnly required />
            <span className="hint">{labels.invite_email_hint}</span>
          </>
        ) : (
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={sent?.email ?? ""}
          />
        )}
      </label>
      <label className="field">
        {labels.password_label}
        <input
          ref={password}
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 8 : 1}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
        />
      </label>

      {state?.error && (
        <p style={{ color: "var(--status-danger-text)", fontSize: 13 }} role="alert">
          {labels[state.error]}
          {state.error === "error_email_taken" && (
            <>
              {" "}
              <Link href="/forgot" className="link">{labels.forgot_link}</Link>
            </>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary"
      >
        {mode === "login" ? labels.login_submit : labels.register_submit}
      </button>

      {mode === "login" && (
        <p style={{ margin: 0, fontSize: 13 }}>
          <Link href="/forgot" className="link">{labels.forgot_link}</Link>
        </p>
      )}

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
