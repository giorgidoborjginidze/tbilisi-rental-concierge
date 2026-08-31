"use client";

import { useActionState } from "react";
import { saveNotifySetup } from "@/lib/rentals/actions";
import type { FormState } from "@/lib/units/actions";

export interface TemplateField {
  key: string;
  label: string;
  /** The wording in force: the workspace's own edit, or the default. */
  body: string;
  /** True when `body` is still the built-in default. */
  isDefault: boolean;
}

// The eight message bodies, editable in place. Clearing a field drops the
// override and the built-in wording comes back, which is why the
// placeholder always shows the default.
export default function TemplatesForm({
  assetId,
  notifyPhone,
  fields,
  labels,
}: {
  assetId: string;
  notifyPhone: string;
  fields: TemplateField[];
  labels: Record<string, string>;
}) {
  const [state, save, saving] = useActionState<FormState, FormData>(
    saveNotifySetup,
    null,
  );

  return (
    <form action={save} className="card" style={{ padding: 18 }}>
      <input type="hidden" name="assetId" value={assetId} />

      <label className="field" style={{ maxWidth: 320 }}>
        {labels.tpl_notify_phone}
        <input
          name="notifyPhone"
          type="tel"
          defaultValue={notifyPhone}
          placeholder="+995 5XX XX XX XX"
        />
        <span className="field-hint">{labels.tpl_notify_phone_hint}</span>
      </label>

      <p className="field-hint" style={{ marginTop: 14 }}>
        {labels.tpl_vars_hint}
      </p>

      <div className="tpl-grid">
        {fields.map((field) => (
          <label key={field.key} className="field">
            <span className="tpl-grid__label">
              {field.label}
              {!field.isDefault && <span className="tpl-grid__edited">✎</span>}
            </span>
            <textarea
              name={`tpl_${field.key}`}
              rows={6}
              defaultValue={field.isDefault ? "" : field.body}
              placeholder={field.body}
            />
          </label>
        ))}
      </div>

      {state?.error && <p className="form-error">{labels[state.error]}</p>}
      <button
        type="submit"
        className="btn-primary"
        disabled={saving}
        style={{ marginTop: 14 }}
      >
        {labels.tpl_save}
      </button>
    </form>
  );
}
