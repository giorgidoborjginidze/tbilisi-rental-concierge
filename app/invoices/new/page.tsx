import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator, readOnlyOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { titled } from "@/lib/i18n/metadata";
import { dayKey, startOfTodayTbilisi } from "@/lib/time";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { periodAmount, statusFor } from "@/lib/rentals/terms";
import { addPeriods } from "@/lib/rentals/schedule";
import { asPeriod } from "@/lib/rentals/amount";
import { CURRENCIES } from "@/lib/fx/convert";
import { invoiceDraft } from "@/lib/invoices/draft";
import { createInvoice } from "@/lib/invoices/actions";
import { firstParam, type QueryValue } from "@/lib/params";

// A new invoice. From a contract (the rental desk's "Make an invoice") it
// is filled in already — the renter, the rent owed now or the next
// period's — and the owner only checks it and issues it.
export const dynamic = "force-dynamic";
export const generateMetadata = titled("invoice_new");

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ contract?: QueryValue; asset?: QueryValue; error?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const locale = await getLocale();
  const query = await searchParams;
  const contractId = firstParam(query.contract);
  const error = firstParam(query.error);
  const today = startOfTodayTbilisi();

  const contract = contractId
    ? await prisma.rentalContract.findFirst({
        where: { id: contractId, ...LIVE_CONTRACT, asset: { operatorId: operator.id } },
        include: { asset: true },
      })
    : null;
  const assetId = contract?.assetId ?? firstParam(query.asset) ?? null;
  const asset = !contract && assetId
    ? await prisma.asset.findFirst({ where: { id: assetId, operatorId: operator.id }, select: { id: true, name: true, nameKa: true, currency: true } })
    : null;
  // Without a contract: the running and coming ones, to start from.
  const contracts = contract
    ? []
    : await prisma.rentalContract.findMany({
        where: { ...LIVE_CONTRACT, endDate: { gt: today }, asset: { operatorId: operator.id, ...(asset ? { id: asset.id } : {}) } },
        include: { asset: { select: { name: true, nameKa: true } } },
        orderBy: { startDate: "desc" },
        take: 30,
      });

  const nameOf = (row: { name: string; nameKa: string | null }) => (locale === "ka" && row.nameKa ? row.nameKa : row.name);
  let defaults = {
    billTo: "",
    billToPhone: "",
    description: "",
    amount: "",
    currency: asset?.currency ?? "GEL",
    periodStart: "",
    periodEnd: "",
    dueDate: dayKey(today),
  };
  if (contract) {
    const rent = periodAmount(contract);
    const draft = contract.paidThrough
      ? invoiceDraft(contract, statusFor(contract, today, contract.asset), rent)
      : { periodStart: today, periodEnd: addPeriods(today, asPeriod(contract.paymentPeriod), 1), amount: rent, dueDate: today };
    defaults = {
      billTo: contract.tenantName ?? "",
      billToPhone: contract.tenantPhone ?? "",
      description: `${t(locale, contract.asset.category === "vehicle" ? "invoice_desc_car" : "invoice_desc_rent")} — ${nameOf(contract.asset)}`,
      amount: String(draft.amount),
      currency: contract.currency,
      periodStart: dayKey(draft.periodStart),
      periodEnd: dayKey(new Date(draft.periodEnd.getTime() - 86_400_000)),
      dueDate: dayKey(draft.dueDate),
    };
  } else if (asset) {
    defaults.description = `${t(locale, "invoice_desc_rent")} — ${nameOf(asset)}`;
  }

  return (
    <main>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/invoices">← {t(locale, "invoices_title")}</Link>
      </p>
      <h1>{t(locale, "invoice_new")}</h1>

      {!contract && contracts.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <p className="field-hint" style={{ margin: "0 0 8px" }}>{t(locale, "invoice_from_contract")}</p>
          <div className="flex flex-wrap gap-2">
            {contracts.map((row) => (
              <Link key={row.id} href={`/invoices/new?contract=${row.id}`} className="btn-chip">
                {[row.tenantName, nameOf(row.asset)].filter(Boolean).join(" — ")}
              </Link>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p className="alert-card alert-card--danger" role="alert" style={{ display: "block", fontSize: 13 }}>
          {t(locale, error as StringKey) || t(locale, "error_required")}
        </p>
      )}

      <form action={createInvoice} className="card invoice-form" style={{ padding: 18 }}>
        {contract && <input type="hidden" name="contractId" value={contract.id} />}
        {!contract && asset && <input type="hidden" name="assetId" value={asset.id} />}
        <label className="field">
          {t(locale, "invoice_to")} *
          <input name="billTo" defaultValue={defaults.billTo} required maxLength={120} />
        </label>
        <label className="field">
          {t(locale, "invoice_phone")}
          <input name="billToPhone" type="tel" defaultValue={defaults.billToPhone} maxLength={30} />
        </label>
        <label className="field invoice-form__wide">
          {t(locale, "invoice_description")} *
          <input name="description" defaultValue={defaults.description} required maxLength={300} />
        </label>
        <label className="field">
          {t(locale, "invoice_amount")} *
          <input name="amount" inputMode="decimal" defaultValue={defaults.amount} required />
        </label>
        <label className="field">
          {t(locale, "contract_currency")}
          <select name="currency" defaultValue={defaults.currency}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </label>
        <label className="field">
          {t(locale, "invoice_period_from")}
          <input name="periodStart" type="date" defaultValue={defaults.periodStart} />
        </label>
        <label className="field">
          {t(locale, "invoice_period_to")}
          <input name="periodEndShown" type="date" defaultValue={defaults.periodEnd} />
        </label>
        <label className="field">
          {t(locale, "invoice_due")}
          <input name="dueDate" type="date" defaultValue={defaults.dueDate} />
        </label>
        <label className="field invoice-form__wide">
          {t(locale, "invoice_note")}
          <textarea name="note" rows={2} maxLength={500} />
        </label>
        <div className="invoice-form__wide">
          <button type="submit" className="btn-primary" disabled={readOnlyOperator(operator)}>
            {t(locale, "invoice_issue")}
          </button>
          <p className="field-hint" style={{ marginTop: 8 }}>{t(locale, "invoice_issue_hint")}</p>
        </div>
      </form>
    </main>
  );
}
