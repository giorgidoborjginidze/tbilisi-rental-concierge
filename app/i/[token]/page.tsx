import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadInvoiceView } from "@/lib/invoices/view";
import { t } from "@/lib/i18n/strings";
import InvoicePaper from "@/app/invoices/invoice-paper";
import PrintButton from "@/app/invoices/print-button";

// The renter's copy of an invoice: the link the owner sends them. No
// sign-in; the address itself is the key (a long random token), and it is
// never indexed.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const view = await loadInvoiceView({ shareToken: token });
  if (!view || view.invoice.status === "void") notFound();
  return (
    <main className="invoice-page">
      <InvoicePaper invoice={view.invoice} issuer={view.issuer} payTo={view.payTo} placeName={view.placeName} locale={view.locale} />
      <p className="invoice-actions no-print">
        <PrintButton label={t(view.locale, "invoice_print")} />
      </p>
    </main>
  );
}
