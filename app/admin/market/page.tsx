import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { monthKeyTbilisi } from "@/lib/time";
import { districtLabel } from "@/lib/places";
import { deleteFigure } from "@/lib/market/admin-actions";
import { MIN_SAMPLE, MIN_WORKSPACES } from "@/lib/market/activo";
import ConfirmAction from "@/app/confirm-action";
import { IconClose } from "@/app/icons";
import { ListingsForm, ReportForm } from "./forms";

// Activo's market data, kept by its admin: report figures typed in,
// listing exports turned into district averages, and — read-only here —
// what customers' own anonymous data says. The calculators, the market
// rent on /assets and the pricing advice blend them (lib/market/figures.ts).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Market data · Activo", robots: { index: false, follow: false } };

const METRIC_KEY = { rent_sqm: "market_m_rent", sale_sqm: "market_m_sale", adr: "market_m_adr", occupancy: "market_m_occ" } as const;
const SOURCE_KEY = { report: "market_s_report", listings: "market_s_listings", activo: "market_s_activo" } as const;

export default async function MarketAdminPage() {
  await requireAdmin();
  const locale = await getLocale();
  const month = monthKeyTbilisi();
  const figures = await prisma.marketFigure.findMany({
    orderBy: [{ period: "desc" }, { district: "asc" }, { metric: "asc" }],
    take: 500,
  });
  const keys = [
    "market_source_name", "market_period", "market_lines", "market_lines_hint", "market_note", "market_save",
    "market_saved", "market_listings_source", "market_file", "market_paste", "market_listings_hint", "market_import",
    "market_err_source", "market_err_period", "market_err_lines", "market_err_file", "market_err_columns", "market_err_few",
  ] as const;
  const labels = Object.fromEntries(keys.map((key) => [key, t(locale, key)]));
  const show = (metric: string, value: number) =>
    metric === "occupancy" ? `${Math.round(value * 100)}%` : `${Math.round(value * 100) / 100} ₾`;

  return (
    <main style={{ maxWidth: 980 }}>
      <h1>{t(locale, "market_title")}</h1>
      <p className="page-lead">{t(locale, "market_lead")}</p>
      <p className="field-hint">
        <Link href="/admin/accounts" className="link">{t(locale, "admin_accounts_title")}</Link>
      </p>

      <section style={{ marginTop: 18 }}>
        <h2>1. {t(locale, "market_s_report")}</h2>
        <p className="field-hint" style={{ margin: "0 0 10px" }}>{t(locale, "market_report_hint")}</p>
        <ReportForm labels={labels} month={month} />
      </section>

      <section style={{ marginTop: 22 }}>
        <h2>2. {t(locale, "market_s_listings")}</h2>
        <p className="field-hint" style={{ margin: "0 0 10px" }}>{t(locale, "market_listings_intro")}</p>
        <ListingsForm labels={labels} month={month} />
      </section>

      <section style={{ marginTop: 22 }}>
        <h2>3. {t(locale, "market_s_activo")}</h2>
        <p className="field-hint" style={{ margin: 0 }}>
          {t(locale, "market_activo_hint").replace("{n}", String(MIN_SAMPLE)).replace("{w}", String(MIN_WORKSPACES))}
        </p>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2>{t(locale, "market_all")}</h2>
        {figures.length === 0 ? (
          <p className="files-empty">{t(locale, "market_none")}</p>
        ) : (
          <div className="card card--stack">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t(locale, "market_period")}</th>
                  <th scope="col">{t(locale, "unit_district")}</th>
                  <th scope="col">{t(locale, "market_metric")}</th>
                  <th scope="col" className="num">{t(locale, "market_value")}</th>
                  <th scope="col">{t(locale, "market_source")}</th>
                  <th scope="col" className="num">n</th>
                  <th scope="col"><span className="visually-hidden">{t(locale, "delete")}</span></th>
                </tr>
              </thead>
              <tbody>
                {figures.map((row) => (
                  <tr key={row.id}>
                    <td data-label={t(locale, "market_period")}>{row.period}</td>
                    <td data-label={t(locale, "unit_district")}>{districtLabel(locale, row.district)}</td>
                    <td data-label={t(locale, "market_metric")}>{t(locale, METRIC_KEY[row.metric as keyof typeof METRIC_KEY] ?? "market_m_rent")}</td>
                    <td className="num" data-label={t(locale, "market_value")}>{show(row.metric, row.value)}</td>
                    <td data-label={t(locale, "market_source")}>
                      {t(locale, SOURCE_KEY[row.source as keyof typeof SOURCE_KEY] ?? "market_s_report")}
                      {row.sourceName && <div className="cell-sub">{row.sourceName}</div>}
                    </td>
                    <td className="num" data-label="n">{row.sampleSize || "—"}</td>
                    <td className="num">
                      {row.source !== "activo" && (
                        <ConfirmAction
                          action={deleteFigure}
                          fields={{ id: row.id }}
                          trigger={<IconClose size={15} />}
                          ariaLabel={t(locale, "delete")}
                          question={t(locale, "market_delete_q")}
                          confirmLabel={t(locale, "delete")}
                          cancelLabel={t(locale, "cancel")}
                          inline
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
