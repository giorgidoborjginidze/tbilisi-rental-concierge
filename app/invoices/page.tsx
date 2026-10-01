import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { titled } from "@/lib/i18n/metadata";
import { tbilisiFormat, startOfTodayTbilisi } from "@/lib/time";
import { formatMoney } from "@/lib/format";
import { invoiceLabel, invoiceOverdue } from "@/lib/invoices/draft";
import { saveInvoiceIssuer } from "@/lib/invoices/actions";
import { firstParam, type QueryValue } from "@/lib/params";
import { badgeClass } from "@/lib/ui/tone";

// Every invoice the account has issued, the unpaid first; what is still
// owed on them; and the "from" block they print with.
export const dynamic = "force-dynamic";
export const generateMetadata = titled("invoices_title");

const SHOW = ["open", "paid", "all"] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: QueryValue; asset?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const locale = await getLocale();
  const query = await searchParams;
  const show = (SHOW as readonly string[]).includes(firstParam(query.show) ?? "") ? firstParam(query.show)! : "open";
  const assetId = firstParam(query.asset) ?? null;
  const today = startOfTodayTbilisi();

  const [invoices, me, openAll] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        operatorId: operator.id,
        ...(assetId ? { assetId } : {}),
        ...(show === "open" ? { status: "issued" } : show === "paid" ? { status: "paid" } : {}),
      },
      orderBy: [{ number: "desc" }],
      take: 200,
      include: { asset: { select: { name: true, nameKa: true } } },
    }),
    prisma.operator.findUnique({ where: { id: operator.id }, select: { invoiceIssuer: true } }),
    prisma.invoice.findMany({
      where: { operatorId: operator.id, status: "issued", ...(assetId ? { assetId } : {}) },
      select: { amount: true, currency: true, dueDate: true, status: true },
    }),
  ]);
  const fmt = tbilisiFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const fmtDay = tbilisiFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  // Owed on unpaid invoices, per currency (no conversion: these are bills).
  const owed = new Map<string, number>();
  for (const invoice of openAll) owed.set(invoice.currency, (owed.get(invoice.currency) ?? 0) + invoice.amount);
  const overdue = openAll.filter((invoice) => invoiceOverdue(invoice, today)).length;
  const href = (key: string) => `/invoices?show=${key}${assetId ? `&asset=${assetId}` : ""}`;

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ margin: 0 }}>{t(locale, "invoices_title")}</h1>
        {!operator.isDemo && (
          <Link href={`/invoices/new${assetId ? `?asset=${assetId}` : ""}`} className="btn-primary">
            {t(locale, "invoice_new")}
          </Link>
        )}
      </div>
      <p className="page-lead">{t(locale, "invoices_lead")}</p>

      {openAll.length > 0 && (
        <p className="invoice-owed">
          {t(locale, "invoices_owed")}:{" "}
          <strong>{[...owed].map(([currency, sum]) => formatMoney(sum, currency, "auto")).join(" + ")}</strong>
          {overdue > 0 && (
            <span className={badgeClass("danger")} style={{ marginLeft: 8 }}>
              {t(locale, "invoices_overdue").replace("{n}", String(overdue))}
            </span>
          )}
        </p>
      )}

      <nav className="flex flex-wrap gap-2" aria-label={t(locale, "invoices_title")} style={{ margin: "12px 0" }}>
        {SHOW.map((key) => (
          <Link key={key} href={href(key)} className={`btn-chip${key === show ? " btn-chip--active" : ""}`} aria-current={key === show ? "true" : undefined}>
            {t(locale, `invoices_show_${key}`)}
          </Link>
        ))}
      </nav>

      {invoices.length === 0 ? (
        <p className="files-empty">{t(locale, show === "open" ? "invoices_none_open" : "invoices_none")}</p>
      ) : (
        <ul className="invoice-list">
          {invoices.map((invoice) => {
            const late = invoiceOverdue(invoice, today);
            const place = invoice.asset ? (locale === "ka" && invoice.asset.nameKa ? invoice.asset.nameKa : invoice.asset.name) : null;
            return (
              <li key={invoice.id}>
                <Link href={`/invoices/${invoice.id}`} className="invoice-list__row">
                  <span className="invoice-list__no">№ {invoiceLabel(invoice.number, invoice.issuedAt)}</span>
                  <span className="invoice-list__who">
                    {invoice.billTo}
                    <span className="invoice-list__sub">
                      {[place, fmt.format(invoice.issuedAt)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="invoice-list__amount">{formatMoney(invoice.amount, invoice.currency, "auto")}</span>
                  <span
                    className={badgeClass(
                      invoice.status === "paid" ? "good" : invoice.status === "void" ? "muted" : late ? "danger" : "warn",
                    )}
                  >
                    {invoice.status === "paid"
                      ? t(locale, "invoice_status_paid")
                      : invoice.status === "void"
                        ? t(locale, "invoice_status_void")
                        : late
                          ? `${t(locale, "invoice_status_overdue")} · ${fmtDay.format(invoice.dueDate!)}`
                          : t(locale, "invoice_status_issued")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* What every invoice prints as "from". */}
      <section id="issuer" style={{ marginTop: 28 }}>
        <h2>{t(locale, "invoice_issuer_title")}</h2>
        <form action={saveInvoiceIssuer} className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
          <input type="hidden" name="back" value="/invoices#issuer" />
          <label className="field">
            {t(locale, "invoice_issuer_label")}
            <textarea
              name="invoiceIssuer"
              rows={4}
              defaultValue={me?.invoiceIssuer ?? ""}
              placeholder={t(locale, "invoice_issuer_placeholder")}
              disabled={operator.isDemo}
            />
            <span className="field-hint">{t(locale, "invoice_issuer_hint")}</span>
          </label>
          {!operator.isDemo && (
            <div>
              <button type="submit" className="btn-secondary">{t(locale, "save")}</button>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
