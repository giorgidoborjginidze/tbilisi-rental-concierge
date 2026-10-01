import { t, type Locale } from "@/lib/i18n/strings";
import { tbilisiFormat } from "@/lib/time";
import { formatMoney } from "@/lib/format";
import { invoiceLabel } from "@/lib/invoices/draft";

// The invoice itself, as it prints and as the renter sees it at their
// link: who issues it, to whom, for what period, how much, and how to pay.

export interface PaperInvoice {
  number: number;
  issuedAt: Date;
  dueDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  billTo: string;
  billToPhone: string | null;
  description: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: Date | null;
  note: string | null;
}

export default function InvoicePaper({
  invoice,
  issuer,
  payTo,
  placeName,
  locale,
}: {
  invoice: PaperInvoice;
  /** The owner's "from" block (Settings on /invoices), or their name. */
  issuer: string;
  payTo: string | null;
  placeName: string | null;
  locale: Locale;
}) {
  // Instants (issued, paid) in Tbilisi time; calendar days (due, period) as stored.
  const fmt = tbilisiFormat(locale, { day: "numeric", month: "long", year: "numeric" });
  const fmtDay = tbilisiFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const lastNight = invoice.periodEnd ? new Date(invoice.periodEnd.getTime() - 86_400_000) : null;
  const period =
    invoice.periodStart && lastNight && lastNight >= invoice.periodStart
      ? `${fmtDay.format(invoice.periodStart)} – ${fmtDay.format(lastNight)}`
      : null;
  return (
    <article className="invoice-paper" data-status={invoice.status}>
      <header className="invoice-paper__head">
        <div>
          <h1>
            {t(locale, "invoice_word")} № {invoiceLabel(invoice.number, invoice.issuedAt)}
          </h1>
          <p>
            {t(locale, "invoice_issued")}: {fmt.format(invoice.issuedAt)}
            {invoice.dueDate && (
              <>
                <br />
                {t(locale, "invoice_due")}: <strong>{fmtDay.format(invoice.dueDate)}</strong>
              </>
            )}
          </p>
        </div>
        {invoice.status !== "issued" && (
          <span className={`invoice-paper__stamp invoice-paper__stamp--${invoice.status}`}>
            {t(locale, invoice.status === "paid" ? "invoice_stamp_paid" : "invoice_stamp_void")}
          </span>
        )}
      </header>

      <div className="invoice-paper__parties">
        <div>
          <h2>{t(locale, "invoice_from")}</h2>
          <p className="invoice-paper__pre">{issuer}</p>
        </div>
        <div>
          <h2>{t(locale, "invoice_to")}</h2>
          <p className="invoice-paper__pre">
            {invoice.billTo}
            {invoice.billToPhone ? `\n${invoice.billToPhone}` : ""}
          </p>
        </div>
      </div>

      <table className="invoice-paper__lines">
        <thead>
          <tr>
            <th scope="col">{t(locale, "invoice_description")}</th>
            <th scope="col" className="num">{t(locale, "invoice_amount")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {invoice.description}
              {placeName && !invoice.description.includes(placeName) && <div className="invoice-paper__sub">{placeName}</div>}
              {period && <div className="invoice-paper__sub">{t(locale, "invoice_period")}: {period}</div>}
            </td>
            <td className="num">{formatMoney(invoice.amount, invoice.currency, "auto")}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t(locale, "invoice_total")}</th>
            <td className="num">
              <strong>{formatMoney(invoice.amount, invoice.currency, "auto")}</strong>
            </td>
          </tr>
        </tfoot>
      </table>

      {payTo && (
        <div className="invoice-paper__pay">
          <h2>{t(locale, "invoice_pay_to")}</h2>
          <p className="invoice-paper__pre">{payTo}</p>
        </div>
      )}
      {invoice.note && <p className="invoice-paper__pre invoice-paper__note">{invoice.note}</p>}
      {invoice.status === "paid" && invoice.paidAt && (
        <p className="invoice-paper__note">
          {t(locale, "invoice_paid_on")}: {fmt.format(invoice.paidAt)}
        </p>
      )}
    </article>
  );
}
