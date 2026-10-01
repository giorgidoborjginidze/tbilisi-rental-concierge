import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { loadInvoiceView } from "@/lib/invoices/view";
import { setInvoiceStatus } from "@/lib/invoices/actions";
import { invoiceLabel } from "@/lib/invoices/draft";
import { shownOrigin } from "@/lib/site";
import { normalizePhone } from "@/lib/notify/phone";
import { formatMoney } from "@/lib/format";
import { firstParam, type QueryValue } from "@/lib/params";
import ConfirmAction from "@/app/confirm-action";
import CopyLink from "@/app/copy-link";
import InvoicePaper from "../invoice-paper";
import PrintButton from "../print-button";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ issued?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const { id } = await params;
  const locale = await getLocale();
  const view = await loadInvoiceView({ id, operatorId: operator.id }, locale);
  if (!view) notFound();
  const { invoice } = view;
  const issued = firstParam((await searchParams).issued) === "1";

  const link = `${shownOrigin(await headers())}/i/${invoice.shareToken}`;
  const phone = normalizePhone(invoice.billToPhone)?.replace(/\D/g, "");
  const waText = t(locale, "invoice_wa_text")
    .replace("{number}", invoiceLabel(invoice.number, invoice.issuedAt))
    .replace("{amount}", formatMoney(invoice.amount, invoice.currency, "auto"))
    .replace("{link}", link);
  const waHref = `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(waText)}`;
  const readOnly = operator.isDemo;

  return (
    <main className="invoice-page">
      <p className="no-print" style={{ margin: "0 0 12px" }}>
        <Link href="/invoices">← {t(locale, "invoices_title")}</Link>
      </p>
      {issued && (
        <p className="alert-card alert-card--good no-print" role="status" style={{ display: "block", fontSize: 13 }}>
          {t(locale, "invoice_issued_note")}
        </p>
      )}
      <InvoicePaper invoice={invoice} issuer={view.issuer} payTo={view.payTo} placeName={view.placeName} locale={locale} />

      <div className="invoice-actions no-print">
        <PrintButton label={t(locale, "invoice_print")} />
        {invoice.status !== "void" && (
          <>
            <a href={waHref} target="_blank" rel="noopener" className="btn-secondary">
              {t(locale, "invoice_send_wa")}
            </a>
            <CopyLink value={link} label={t(locale, "copy_link")} copied={t(locale, "copied")} />
          </>
        )}
        {!readOnly && invoice.status === "issued" && (
          <form action={setInvoiceStatus}>
            <input type="hidden" name="id" value={invoice.id} />
            <input type="hidden" name="status" value="paid" />
            <button type="submit" className="btn-secondary">{t(locale, "invoice_mark_paid")}</button>
          </form>
        )}
        {!readOnly && invoice.status === "paid" && (
          <form action={setInvoiceStatus}>
            <input type="hidden" name="id" value={invoice.id} />
            <input type="hidden" name="status" value="issued" />
            <button type="submit" className="btn-secondary">{t(locale, "invoice_mark_unpaid")}</button>
          </form>
        )}
        {!readOnly && invoice.status !== "void" && (
          <ConfirmAction
            action={setInvoiceStatus}
            fields={{ id: invoice.id, status: "void" }}
            trigger={t(locale, "invoice_void")}
            triggerClassName="btn-chip btn-chip--danger"
            question={t(locale, "invoice_void_q")}
            confirmLabel={t(locale, "invoice_void")}
            cancelLabel={t(locale, "cancel")}
            inline
          />
        )}
      </div>
      {invoice.status === "issued" && invoice.contractId && invoice.assetId && (
        <p className="field-hint no-print" style={{ marginTop: 10 }}>
          {t(locale, "invoice_record_hint")}{" "}
          <Link href={`/assets/${invoice.assetId}/rental?tab=payments`}>{t(locale, "invoice_record_link")}</Link>
        </p>
      )}
      <p className="field-hint no-print" style={{ marginTop: 6 }}>{t(locale, "invoice_link_hint")}</p>
    </main>
  );
}
