"use client";

import { useActionState, useState } from "react";
import { eraseMyAccount } from "@/lib/account/actions";
import type { FormState } from "@/lib/units/actions";

// Access, portability and erasure, as two buttons rather than a support
// address. The export is a plain link — a GET the browser downloads — and
// the erasure asks the operator to type their own email, which is a
// confirmation only the account holder can satisfy and one that no
// mis-click can produce by accident.
export default function DataRights({
  email,
  labels,
}: {
  email: string;
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    eraseMyAccount,
    null,
  );
  const [armed, setArmed] = useState(false);

  return (
    <section style={{ marginTop: 20 }}>
      <h2>{labels.settings_data}</h2>
      <p
        style={{
          color: "var(--color-text-muted)",
          maxWidth: 620,
          marginTop: 4,
          fontSize: 13,
        }}
      >
        {labels.settings_data_intro}
      </p>

      <div
        className="card"
        style={{ marginTop: 12, padding: 18, display: "grid", gap: 18 }}
      >
        {/* ── Export ── */}
        <div style={{ display: "grid", gap: 8 }}>
          <strong>📦 {labels.data_export_title}</strong>
          <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
            {labels.data_export_hint}
          </span>
          <a
            href="/api/account/export"
            download
            className="btn-secondary"
            style={{ justifySelf: "start" }}
          >
            {labels.data_export_cta}
          </a>
        </div>

        <hr style={{ border: 0, borderTop: "1px solid var(--color-border)" }} />

        {/* ── Erasure ── */}
        <div style={{ display: "grid", gap: 8 }}>
          <strong>🗑️ {labels.data_erase_title}</strong>
          <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
            {labels.data_erase_hint}
          </span>

          {!armed ? (
            <button
              type="button"
              className="btn-chip"
              style={{ justifySelf: "start", color: "var(--color-danger, #b42318)" }}
              onClick={() => setArmed(true)}
            >
              {labels.data_erase_title}
            </button>
          ) : (
            <form action={formAction} style={{ display: "grid", gap: 8 }}>
              <label className="field" style={{ maxWidth: 360 }}>
                {labels.data_erase_confirm_label.replace("{email}", email)}
                <input
                  name="confirm"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={email}
                />
              </label>
              {state?.error && (
                <span style={{ color: "var(--color-danger, #b42318)", fontSize: 13 }}>
                  {labels[state.error] ?? labels.error_erase_confirm}
                </span>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn-secondary"
                  disabled={pending}
                  style={{ color: "var(--color-danger, #b42318)" }}
                >
                  {labels.data_erase_cta}
                </button>
                <button
                  type="button"
                  className="btn-chip"
                  onClick={() => setArmed(false)}
                >
                  {labels.cancel}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
