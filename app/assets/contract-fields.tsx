"use client";

import { useState } from "react";
import { asPeriod, monthlyEquivalent } from "@/lib/rentals/amount";
import { defaultPaidThrough } from "@/lib/rentals/schedule";
import { dayFromKey, dayKey, todayKey } from "@/lib/time";
import { Req } from "@/app/form-bits";
import { formatNumber } from "@/lib/number";

const AMOUNT_LABEL = {
  daily: "contract_amount_daily",
  weekly: "contract_amount_weekly",
  monthly: "contract_amount_monthly",
} as const;

export interface ContractValues {
  tenantName?: string;
  tenantPhone?: string;
  paymentPeriod?: string;
  amount?: string;
  startDate?: string;
  endDate?: string;
  paidThrough?: string;
  graceDays?: string;
  deposit?: string;
  notes?: string;
  remindersEnabled?: boolean;
}

/** One year after a "YYYY-MM-DD" day (the usual lease), as "YYYY-MM-DD". */
const yearAfter = (key: string) => {
  const date = dayFromKey(key);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return dayKey(date);
};

// The fields of a rental contract, shared by the contract form (add and
// edit) and the "tenant & rent" step of a new asset. The frequency comes
// first because it decides what the amount means: what the renter pays per
// day, per week or per month, exactly as agreed. "Paid up to" follows the
// first due date on or after today until the owner types a date, so a
// lease that has run for months starts in good standing. `compact` keeps
// only what a first entry needs (tenant, phone, rent, dates, paid up to).
export default function ContractFields({
  labels,
  initial,
  compact = false,
  suggestDates = false,
}: {
  labels: Record<string, string>;
  initial?: ContractValues;
  compact?: boolean;
  /** Start today and end a year later unless the owner says otherwise. */
  suggestDates?: boolean;
}) {
  const today = todayKey();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">(
    asPeriod(initial?.paymentPeriod ?? "monthly"),
  );
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [start, setStart] = useState(initial?.startDate ?? (suggestDates ? today : ""));
  const [end, setEnd] = useState(initial?.endDate ?? (suggestDates ? yearAfter(today) : ""));
  // Until the owner types a date, "paid up to" follows the suggestion.
  const [paidTyped, setPaidTyped] = useState<string | null>(initial?.paidThrough || null);

  const suggestedPaid =
    start && end && end > start
      ? dayKey(defaultPaidThrough(dayFromKey(start), dayFromKey(end), period, dayFromKey(today)))
      : "";
  const paidThrough = paidTyped ?? suggestedPaid;

  const amountNumber = Number(amount);
  const monthly =
    period !== "monthly" && Number.isFinite(amountNumber) && amountNumber > 0
      ? formatNumber(monthlyEquivalent(amountNumber, period))
      : null;

  return (
    <>
      <label className="field">
        {labels.contract_tenant}
        <input name="tenantName" defaultValue={initial?.tenantName} autoComplete="off" />
      </label>
      <label className="field">
        {labels.tenant_phone}
        <input
          name="tenantPhone"
          type="tel"
          inputMode="tel"
          placeholder="+995 5XX XX XX XX"
          defaultValue={initial?.tenantPhone}
        />
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
        <span>
          {labels[AMOUNT_LABEL[period]]}
          <Req />
        </span>
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          min={0.01}
          step="0.01"
          required
          aria-required="true"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        {monthly && (
          <span className="hint">{labels.contract_monthly_equiv.replace("{amount}", monthly)}</span>
        )}
      </label>
      <label className="field">
        <span>
          {labels.contract_start}
          <Req />
        </span>
        <input
          name="startDate"
          type="date"
          required
          aria-required="true"
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
      </label>
      <label className="field">
        <span>
          {labels.contract_end}
          <Req />
        </span>
        <input
          name="endDate"
          type="date"
          required
          aria-required="true"
          min={start || undefined}
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
        <span className="hint">{labels.contract_paid_up_to_hint}</span>
      </label>
      {!compact && (
        <>
          <label className="field">
            {labels.pay_grace}
            <input
              name="graceDays"
              type="number"
              min={0}
              max={60}
              step={1}
              defaultValue={initial?.graceDays ?? "3"}
            />
          </label>
          <label className="field">
            {labels.contract_deposit}
            <input name="deposit" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={initial?.deposit} />
          </label>
          <label className="field">
            {labels.asset_notes}
            <input name="notes" defaultValue={initial?.notes} />
          </label>
          <label className="field col-span-2" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="hidden" name="remindersField" value="1" />
            <input type="checkbox" name="remindersEnabled" defaultChecked={initial?.remindersEnabled ?? true} />
            {labels.contract_reminders}
          </label>
        </>
      )}
    </>
  );
}
