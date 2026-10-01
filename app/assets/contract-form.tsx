"use client";

import { useActionState, useState } from "react";
import { saveContract, updateContract } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";
import ContractFields, { type ContractValues } from "./contract-fields";
import { FormMessage, RequiredLegend } from "@/app/form-bits";
import { keepTyped } from "@/app/keep-typed";

// A rental contract: added on the asset page, or edited in place (a new
// phone number, a lease extended, the rent raised) — never deleted and
// typed again, which would lose its payment history. A save says so; an
// error keeps everything that was typed.
export default function ContractForm({
  assetId,
  labels,
  contract,
  onDone,
  onSaved,
  defaultCurrency,
}: {
  assetId: string;
  /** A new contract's currency (the asset's). */
  defaultCurrency?: string;
  labels: Record<string, string>;
  /** Edit mode: the contract as stored (form values). */
  contract?: ContractValues & { id: string };
  /** Edit mode: close the form (the row shows the saved contract). */
  onDone?: () => void;
  /** Edit mode: the save went through — the row takes over (and says so). */
  onSaved?: () => void;
}) {
  const editing = contract != null;
  // A new form after each added contract (fresh fields, same page).
  const [round, setRound] = useState(0);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (previous, formData) => {
      const result = await (editing ? updateContract : saveContract)(previous, formData);
      if (result?.ok && !editing) setRound((n) => n + 1);
      if (result?.ok && editing) onSaved?.();
      return result;
    },
    null,
  );

  // After an error the form shows what was submitted, not the stored values.
  const sent = state && "values" in state ? state.values : undefined;
  const initial: ContractValues | undefined = sent
    ? {
        tenantName: sent.tenantName,
        tenantPhone: sent.tenantPhone,
        paymentPeriod: sent.paymentPeriod,
        amount: sent.amount,
        startDate: sent.startDate,
        endDate: sent.endDate,
        paidThrough: sent.paidThrough,
        graceDays: sent.graceDays,
        deposit: sent.deposit,
        notes: sent.notes,
        remindersEnabled: sent.remindersEnabled === "on",
        waConsent: sent.waConsent === "on",
        messagesOptOut: sent.messagesOptOut === "on",
        currency: sent.contractCurrency,
      }
    : contract;

  return (
    <form
      action={formAction}
      onSubmit={keepTyped(formAction)}
      className="card form-grid form-grid--full"
      style={{ padding: 18, overflow: "visible" }}
      aria-label={editing ? labels.contract_edit_title : labels.contract_add}
    >
      <input type="hidden" name="assetId" value={assetId} />
      {editing && <input type="hidden" name="contractId" value={contract.id} />}
      {/* What "paid up to" showed: changing it restates the balance. */}
      {editing && <input type="hidden" name="paidThroughWas" value={contract.paidThrough ?? ""} />}
      <RequiredLegend text={labels.form_required_legend} />
      <ContractFields
        key={`${round}-${sent ? "sent" : "stored"}`}
        labels={labels}
        initial={initial}
        suggestDates={!editing}
        defaultCurrency={defaultCurrency}
      />
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {editing ? labels.save : labels.contract_add}
        </button>
        {editing && onDone && (
          <button type="button" className="btn-chip" onClick={onDone}>
            {labels.cancel}
          </button>
        )}
        <FormMessage
          error={state?.error ? labels[state.error] ?? state.error : null}
          saved={state?.ok ? (editing ? labels.contract_saved : labels.contract_added) : null}
        />
      </div>
    </form>
  );
}
