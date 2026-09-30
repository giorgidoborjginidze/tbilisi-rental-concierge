"use client";

import { useActionState } from "react";
import { changeEmail, changePassword } from "@/lib/account/actions";
import type { FormState } from "@/lib/units/actions";

type Labels = Record<string, string>;

function Message({ state, labels, ok }: { state: FormState; labels: Labels; ok: string }) {
  if (!state) return null;
  if ("ok" in state && state.ok) {
    return (
      <p role="status" style={{ margin: 0, fontSize: 13, color: "var(--status-rented-text)" }}>
        {ok}
      </p>
    );
  }
  return (
    <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--status-danger-text)" }}>
      {labels[state.error] ?? labels.error_required}
    </p>
  );
}

export function ChangePasswordForm({ labels }: { labels: Labels }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, null);
  return (
    <form action={action} className="settings-form">
      <strong className="settings-form__title">{labels.password_change}</strong>
      <label className="field">
        {labels.password_current}
        <input name="current" type="password" required autoComplete="current-password" />
      </label>
      <div className="settings-form__pair">
        <label className="field">
          {labels.password_new}
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <label className="field">
          {labels.password_repeat}
          <input name="repeat" type="password" required minLength={8} autoComplete="new-password" />
        </label>
      </div>
      <Message state={state} labels={labels} ok={labels.password_changed} />
      <div>
        <button type="submit" className="btn-secondary" disabled={pending}>
          {labels.password_change}
        </button>
      </div>
    </form>
  );
}

export function ChangeEmailForm({ labels, current }: { labels: Labels; current: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changeEmail, null);
  const sent = state && "values" in state ? state.values : undefined;
  return (
    <form action={action} className="settings-form">
      <strong className="settings-form__title">{labels.email_change}</strong>
      <div className="settings-form__pair">
        <label className="field">
          {labels.email_new}
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={current}
            defaultValue={sent?.email ?? ""}
          />
        </label>
        <label className="field">
          {labels.password_confirm}
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
      </div>
      <Message state={state} labels={labels} ok={labels.email_changed} />
      <div>
        <button type="submit" className="btn-secondary" disabled={pending}>
          {labels.email_change}
        </button>
      </div>
    </form>
  );
}
