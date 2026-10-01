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
  /** Fixed wording (the owner's legal right towards the driver): shown, not edited. */
  fixed?: boolean;
}

// The eight message bodies, editable in place. Clearing a field drops the
// override and the built-in wording comes back, which is why the
// placeholder always shows the default.
export default function TemplatesForm({
  assetId,
  notifyPhone,
  payInstructions,
  fields,
  labels,
  ownerFieldsLocked = false,
}: {
  assetId: string;
  /** A team member: the alert phone and payment details are the owner's. */
  ownerFieldsLocked?: boolean;
  notifyPhone: string;
  /** How renters pay: the {pay_to} of the payment reminders. */
  payInstructions: string;
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
          disabled={ownerFieldsLocked}
        />
        <span className="field-hint">{ownerFieldsLocked ? labels.owner_sets_this : labels.tpl_notify_phone_hint}</span>
      </label>

      <label className="field" style={{ marginTop: 12 }}>
        {labels.tpl_pay_to}
        <input
          name="payInstructions"
          maxLength={160}
          defaultValue={sent?.payInstructions ?? payInstructions}
          placeholder={labels.tpl_pay_to_placeholder}
          disabled={ownerFieldsLocked}
        />
        <span className="field-hint">{ownerFieldsLocked ? labels.owner_sets_this : labels.tpl_pay_to_hint}</span>
      </label>

      <p className="field-hint" style={{ marginTop: 14 }}>
        {labels.tpl_vars_hint}
      </p>

      <div className="tpl-grid">
        {fields.map((field) =>
          field.fixed ? (
            // Read-only: the driver is told about the owner's right in one
            // reviewed wording.
            <div key={field.key} className="field">
              <span className="tpl-grid__label">{field.label}</span>
              <p className="tpl-fixed">{field.body}</p>
              <span className="field-hint">{labels.tpl_fixed_hint}</span>
            </div>
          ) : (
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
          ),
        )}
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
