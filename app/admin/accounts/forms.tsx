"use client";

import { useActionState } from "react";
import { grantPlan, makeResetLink, type AdminState } from "@/lib/admin/account-actions";
import CopyLink from "@/app/copy-link";

const Note = ({ state, labels }: { state: AdminState; labels: Record<string, string> }) =>
  state?.ok ? (
    <p role="status" className="field-hint" style={{ margin: 0, color: "var(--status-rented-text)" }}>
      {labels[state.ok] ?? state.ok}
    </p>
  ) : state?.error ? (
    <p role="alert" className="form-error" style={{ margin: 0 }}>{labels[state.error] ?? state.error}</p>
  ) : null;

export function PlanForm({
  labels,
  plans,
}: {
  labels: Record<string, string>;
  plans: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(grantPlan, null);
  return (
    <form action={action} className="card form-grid" style={{ padding: 18 }}>
      <label className="field">
        {labels.admin_email}
        <input name="email" type="email" required autoComplete="off" />
      </label>
      <label className="field">
        {labels.admin_plan}
        <select name="plan" defaultValue={plans[0]?.id}>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.label}</option>
          ))}
          <option value="none">{labels.admin_plan_none}</option>
        </select>
      </label>
      <label className="field">
        {labels.admin_months}
        <input name="months" type="number" min={1} max={24} defaultValue={1} inputMode="numeric" />
      </label>
      <div className="col-span-2" style={{ display: "grid", gap: 8 }}>
        <Note state={state} labels={labels} />
        <div>
          <button type="submit" className="btn-primary" disabled={pending}>{labels.admin_plan_save}</button>
        </div>
      </div>
    </form>
  );
}

export function ResetLinkForm({ labels }: { labels: Record<string, string> }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(makeResetLink, null);
  return (
    <form action={action} className="card form-grid" style={{ padding: 18 }}>
      <label className="field">
        {labels.admin_email}
        <input name="email" type="email" required autoComplete="off" />
      </label>
      <div className="col-span-2" style={{ display: "grid", gap: 8 }}>
        <Note state={state} labels={labels} />
        {state?.link && (
          <>
            <input readOnly value={state.link} aria-label={labels.admin_link_make} onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13 }} />
            <CopyLink value={state.link} label={labels.admin_copy} copied={labels.admin_copied} />
          </>
        )}
        <div>
          <button type="submit" className="btn-secondary" disabled={pending}>{labels.admin_link_make}</button>
        </div>
      </div>
    </form>
  );
}
