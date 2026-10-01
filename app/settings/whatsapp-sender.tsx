"use client";

import { useActionState } from "react";
import { removeWhatsAppSender, saveWhatsAppSender } from "@/lib/notify/sender-actions";
import type { FormState } from "@/lib/units/actions";
import ConfirmAction from "../confirm-action";

// The owner's own WhatsApp Business number. The token field is always
// empty: a saved token is never sent back to the browser; leaving the
// field blank keeps it.
export default function WhatsAppSender({
  connected,
  broken = false,
  values,
  labels,
}: {
  /** The number Meta named when it was saved, or null when none is connected. */
  connected: string | null;
  /** Connected, but its key no longer opens: nothing is sent until it is saved again. */
  broken?: boolean;
  values: { phoneNumberId: string; templateName: string; templateLocale: string };
  labels: Record<string, string>;
}) {
  const [state, save, pending] = useActionState<FormState, FormData>(saveWhatsAppSender, null);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p className="field-hint" style={{ margin: 0 }}>
        {connected != null ? labels.wa_sender_connected.replace("{phone}", connected || "—") : labels.wa_sender_none}
      </p>
      {broken && (
        <p className="field-hint price-missing" role="alert" style={{ margin: 0 }}>
          {labels.wa_sender_broken}
        </p>
      )}
      <details className="form-fold" open={state?.error != null || broken}>
        <summary>{connected != null ? labels.wa_sender_change : labels.wa_sender_connect}</summary>
        <form action={save} className="form-grid" style={{ marginTop: 10 }} autoComplete="off">
          <label className="field">
            {labels.wa_sender_id}
            <input name="waPhoneNumberId" inputMode="numeric" defaultValue={values.phoneNumberId} required />
          </label>
          <label className="field">
            {labels.wa_sender_token}
            <input name="waToken" type="password" autoComplete="new-password" placeholder={connected != null ? "••••••••" : ""} />
            {connected != null && <span className="field-hint">{labels.wa_sender_token_keep}</span>}
          </label>
          <label className="field">
            {labels.wa_sender_template}
            <input name="waTemplateName" defaultValue={values.templateName || "activo_alert"} />
          </label>
          <label className="field">
            {labels.wa_sender_template_lang}
            <input name="waTemplateLocale" defaultValue={values.templateLocale || "ka"} />
          </label>
          <p className="field-hint col-span-2" style={{ margin: 0 }}>{labels.wa_sender_how}</p>
          {state?.error && <p className="form-error col-span-2">{labels[state.error] ?? labels.wa_sender_rejected}</p>}
          {state?.ok && <p className="col-span-2" role="status">{labels.wa_sender_saved}</p>}
          <div className="col-span-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              {labels.wa_sender_check_save}
            </button>
          </div>
        </form>
      </details>
      {connected != null && (
        <div>
          <ConfirmAction
            action={removeWhatsAppSender}
            fields={{}}
            trigger={labels.wa_sender_remove}
            triggerClassName="btn-chip btn-chip--danger"
            question={labels.wa_sender_remove_q}
            confirmLabel={labels.wa_sender_remove}
            cancelLabel={labels.cancel}
            inline
          />
        </div>
      )}
    </div>
  );
}
