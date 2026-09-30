"use client";

import { useActionState, useState } from "react";
import { saveContract } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";
import { asPeriod, monthlyEquivalent } from "@/lib/rentals/amount";
import { defaultPaidThrough } from "@/lib/rentals/schedule";
import { dayFromKey, dayKey, todayKey } from "@/lib/time";

const AMOUNT_LABEL = {
  daily: "contract_amount_daily",
  weekly: "contract_amount_weekly",
  monthly: "contract_amount_monthly",
} as const;

// A rental contract. The frequency comes first because it decides what the
// amount means: the owner types what the renter pays per day, per week or
// per month, exactly as agreed. "Paid up to" says how far the rent is
// already paid, so a lease that has been running for months starts in good
// standing instead of being announced as months late.
export default function ContractForm({
  assetId,
  labels,
}: {
  assetId: string;
  labels: Record<string, string>;
}) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [amount, setAmount] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  // Until the owner types a date, "paid up to" follows the suggestion.
  const [paidTyped, setPaidTyped] = useState<string | null>(null);

  // A saved contract clears the form (React resets only uncontrolled
  // fields by itself).
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (previous, formData) => {
      const result = await saveContract(previous, formData);
      if (!result?.error) {
        setAmount("");
        setStart("");
        setEnd("");
        setPaidTyped(null);
      }
      return result;
    },
    null,
  );

  const suggestedPaid =
    start && end && end > start
      ? dayKey(
          defaultPaidThrough(dayFromKey(start), dayFromKey(end), period, dayFromKey(todayKey())),
        )
      : "";
  const paidThrough = paidTyped ?? suggestedPaid;

  const amountNumber = Number(amount);
  const monthly =
    period !== "monthly" && Number.isFinite(amountNumber) && amountNumber > 0
      ? Math.round(monthlyEquivalent(amountNumber, period)).toLocaleString("en-US")
      : null;

  return (
    <form
      action={formAction}
      className="card form-grid form-grid--full" style={{ padding: 18, overflow: "visible" }}
    >
      <input type="hidden" name="assetId" value={assetId} />
      <label className="field">
        {labels.contract_tenant}
        <input name="tenantName" />
      </label>
      <label className="field">
        {labels.tenant_phone}
        <input name="tenantPhone" type="tel" placeholder="+995 5XX XX XX XX" />
      </label>
      <label className="field">
        {labels.pay_period}
        <select
          name="paymentPeriod"
          value={period}
          onChange={(event) => setPeriod(asPeriod(event.target.value))}
        >
          <option value="daily">{labels.period_daily}</option>
          <option value="weekly">{labels.period_weekly}</option>
          <option value="monthly">{labels.period_monthly}</option>
        </select>
      </label>
      <label className="field">
        {labels[AMOUNT_LABEL[period]]}
        <input
          name="amount"
          type="number"
          min={0.01}
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        {monthly && (
          <span className="hint">
            {labels.contract_monthly_equiv.replace("{amount}", monthly)}
          </span>
        )}
      </label>
      <label className="field">
        {labels.contract_start}
        <input
          name="startDate"
          type="date"
          required
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
      </label>
      <label className="field">
        {labels.contract_end}
        <input
          name="endDate"
          type="date"
          required
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
      </label>
      <label className="field">
        {labels.contract_paid_up_to}
        <input
          name="paidThrough"
          type="date"
          min={start || undefined}
          max={end || undefined}
          value={paidThrough}
          onChange={(event) => setPaidTyped(event.target.value)}
        />
      </label>
      <label className="field">
        {labels.pay_grace}
        <input name="graceDays" type="number" min={0} max={60} step={1} defaultValue={3} />
      </label>
      <p className="field-hint col-span-2" style={{ marginTop: -4 }}>
        {labels.contract_paid_up_to_hint}
      </p>
      <label className="field">
        {labels.contract_deposit}
        <input name="deposit" type="number" min={0} step="0.01" />
      </label>
      <label className="field">
        {labels.asset_notes}
        <input name="notes" />
      </label>
      <label
        className="field col-span-2"
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <input type="hidden" name="remindersField" value="1" />
        <input type="checkbox" name="remindersEnabled" defaultChecked />
        {labels.contract_reminders}
      </label>
      {state?.error && (
        <p className="col-span-2" style={{ color: "var(--status-danger-text)", fontSize: 13 }}>{labels[state.error]}</p>
      )}
      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
        >
          {labels.contract_add}
        </button>
      </div>
    </form>
  );
}
