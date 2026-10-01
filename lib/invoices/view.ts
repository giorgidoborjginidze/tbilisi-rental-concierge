// One invoice with everything its paper prints: the owner's "from" block
// (or their name and email), how to pay, and the asset's name.

import { prisma } from "@/lib/db";
import { asLocale, type Locale } from "@/lib/i18n/strings";

export async function loadInvoiceView(where: { id: string; operatorId: string } | { shareToken: string }, locale?: Locale) {
  const invoice = await prisma.invoice.findFirst({
    where,
    include: {
      operator: { select: { name: true, email: true, invoiceIssuer: true, payInstructions: true, locale: true } },
      asset: { select: { id: true, name: true, nameKa: true } },
    },
  });
  if (!invoice) return null;
  const shown = locale ?? asLocale(invoice.operator.locale);
  const issuer = invoice.operator.invoiceIssuer?.trim() || [invoice.operator.name, invoice.operator.email].filter(Boolean).join("\n");
  const placeName = invoice.asset ? (shown === "ka" && invoice.asset.nameKa ? invoice.asset.nameKa : invoice.asset.name) : null;
  return { invoice, issuer, payTo: invoice.operator.payInstructions?.trim() || null, placeName, locale: shown };
}
