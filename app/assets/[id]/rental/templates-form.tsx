"use client";

import { useActionState } from "react";
import { saveNotifySetup } from "@/lib/rentals/actions";
import type { FormState } from "@/lib/units/actions";
import { IconEdit } from "@/app/icons";
import { MAX_TEMPLATE_CHARS } from "@/lib/notify/limits";
import { keepingValues } from "@/lib/forms";
import { FormMessage } from "@/app/form-bits";
import { keepTyped } from "@/app/keep-typed";

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
  // An error keeps what was typed; a save says so.
  const [state, save, saving] = useActionState<FormState, FormData>(
    keepingValues(saveNotifySetup),
    null,
  );
  const sent = state && "values" in state ? state.values : undefined;

  return (
    <form action={save} onSubmit={keepTyped(save)} className="card" style={{ padding: 18 }}>
      <input type="hidden" name="assetId" value={assetId} />

      <label className="field" style={{ maxWidth: 320 }}>
        {labels.tpl_notify_phone}
        <input
          name="notifyPhone"
          type="tel"
          defaultValue={sent?.notifyPhone ?? notifyPhone}
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
              {!field.isDefault && (
                <span
                  className="tpl-grid__edited"
                  title={labels.tpl_edited}
                  role="img"
                  aria-label={labels.tpl_edited}
                >
                  <IconEdit size={14} />
                </span>
              )}
            </span>
            <textarea
              name={`tpl_${field.key}`}
              rows={6}
              maxLength={MAX_TEMPLATE_CHARS}
              defaultValue={sent?.[`tpl_${field.key}`] ?? (field.isDefault ? "" : field.body)}
              placeholder={field.body}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 14 }}>
        <button type="submit" className="btn-primary" disabled={saving}>
          {labels.tpl_save}
        </button>
        <FormMessage
          error={state?.error ? labels[state.error] ?? state.error : null}
          saved={state?.ok ? labels.saved_short : null}
        />
      </div>
    </form>
  );
}
