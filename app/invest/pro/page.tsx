import Link from "next/link";
import { getSessionOperator, readOnlyOperator } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { cleanScenario, summarize } from "@/lib/invest/saved";
import { deleteScenario, restoreScenario } from "@/lib/invest/saved-actions";
import { formatMoney } from "@/lib/format";
import { firstParam, type QueryValue } from "@/lib/params";
import { tbilisiFormat } from "@/lib/time";
import { VERDICT_BADGE } from "@/lib/ui/tone";
import { PAYBACK_CAP_YEARS } from "@/lib/invest/market";
import ConfirmAction from "../../confirm-action";
import { IconClose } from "../../icons";
import { getBillingContext } from "@/lib/billing/context";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import ProCalculator from "./pro-calculator";
import InvestSubnav from "../../invest-subnav";
import { titled } from "@/lib/i18n/metadata";
import { SeverityIcon } from "../../alert-icon";
import { IconArrowRight } from "../../icons";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("invest_nav_pro");

const LABEL_KEYS: StringKey[] = [
  "wor_intro", "wor_deal", "wor_price", "wor_equity", "wor_other_costs",
  "wor_rate", "wor_years", "wor_rent", "wor_growth", "wor_vacancy",
  "wor_more", "wor_insurance", "wor_maintenance", "wor_management",
  "wor_utilities", "wor_broker", "wor_hoa", "wor_proptax", "wor_points",
  "wor_tax", "wor_currency", "wor_not_converted",
  "wor_tax_model", "wor_tax_gross", "wor_tax_profit", "wor_tax_hint", "wor_tax_gross_pct",
  "wor_building_share", "wor_depr_years", "wor_example_title", "wor_example_hint",
  "wor_example_badge", "res_years_over",
  "wor_verdict_good", "wor_verdict_ok", "wor_verdict_poor",
  "wor_payment", "wor_invested", "wor_cf_month", "wor_coc", "wor_cap", "wor_cap_short",
  "wor_payback", "wor_equity5", "wor_year", "wor_col_rent", "wor_col_noi",
  "wor_col_cf", "wor_col_coc", "wor_col_equity", "wor_note",
  "res_years", "res_never",
  "calc_name", "calc_name_ph", "calc_save", "calc_save_changes", "calc_save_new", "calc_saved", "calc_limit",
  "error_required",
];

export default async function ProAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ calc?: QueryValue; saved?: QueryValue }>;
}) {
  const operator = await getSessionOperator();
  const locale = await getLocale();

  // Advanced needs an account first; the plan comes after registration.
  if (!operator) {
    return (
      <main>
        <h1>{t(locale, "invest_title")}</h1>
        <InvestSubnav active="pro" />
        <div className="alert-card alert-card--info" style={{ display: "block", maxWidth: 640 }}>
          <p className="alert-card__notice">
            <SeverityIcon severity="info" />
            <span>{t(locale, "wor_register_first")}</span>
          </p>
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <Link href="/register" className="btn-primary">
              {t(locale, "register_free")}
            </Link>
            <Link href="/login" className="btn-secondary">
              {t(locale, "login_title")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const context = await getBillingContext(operator);

  if (!context.plan.analysis) {
    return (
      <main>
        <h1>{t(locale, "invest_title")}</h1>
        <InvestSubnav active="pro" />
        <div className="alert-card alert-card--info" style={{ display: "block", maxWidth: 640 }}>
          <p className="alert-card__notice">
            <SeverityIcon severity="info" />
            <span>{t(locale, "wor_locked")}</span>
          </p>
          <div style={{ marginTop: 14 }}>
            <Link href="/billing" className="btn-primary icon-text">
              {t(locale, "nav_billing")} <IconArrowRight size={16} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const labels = Object.fromEntries(
    LABEL_KEYS.map((key) => [key, t(locale, key)]),
  );

  // Kept scenarios: the one opened (?calc=…), and all of them to compare.
  const query = await searchParams;
  const calcId = firstParam(query.calc);
  const kept = await prisma.savedCalc.findMany({
    where: { operatorId: operator.id, kind: "pro" },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  const opened = kept.find((row) => row.id === calcId) ?? null;
  const rows = kept.map((row) => {
    const scenario = cleanScenario(row.data);
    return { row, scenario, summary: summarize(scenario) };
  });
  const fmtDate = tbilisiFormat(locale, { day: "numeric", month: "short" });
  const years = (v: number | null) =>
    v == null ? t(locale, "res_never") : v > PAYBACK_CAP_YEARS ? `${PAYBACK_CAP_YEARS}+` : v.toFixed(1);

  return (
    <main>
      <h1>{t(locale, "invest_title")}</h1>
      <InvestSubnav active="pro" />
      <div className="flex flex-wrap items-center gap-2">
        <h2 style={{ marginBottom: 0 }}>{t(locale, "wor_title")}</h2>
        <span className="badge badge--tag">PRO</span>
      </div>
      <p className="mb-5" style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 640, marginTop: 8 }}>
        {t(locale, "wor_intro")}
      </p>
      <ProCalculator
        key={opened?.id ?? "new"}
        labels={labels}
        canSave={!readOnlyOperator(operator)}
        justSaved={firstParam(query.saved) === "1"}
        initial={opened ? { id: opened.id, name: opened.name, scenario: cleanScenario(opened.data) } : null}
      />

      {/* Kept scenarios, side by side: the figures that decide a purchase. */}
      {rows.length > 0 && (
        <section id="kept" style={{ marginTop: 28 }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 style={{ margin: 0 }}>{t(locale, "calc_kept_title")}</h2>
            {opened && (
              <Link href="/invest/pro" className="btn-chip">{t(locale, "calc_new")}</Link>
            )}
          </div>
          <p className="field-hint" style={{ margin: "6px 0 10px" }}>{t(locale, "calc_kept_hint")}</p>
          <div className="card card--stack">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t(locale, "calc_name")}</th>
                  <th scope="col">{t(locale, "calc_col_verdict")}</th>
                  <th scope="col" className="num">{t(locale, "wor_price")}</th>
                  <th scope="col" className="num">{t(locale, "wor_cf_month")}</th>
                  <th scope="col" className="num">{t(locale, "wor_coc")}</th>
                  <th scope="col" className="num">{t(locale, "wor_cap")}</th>
                  <th scope="col" className="num">{t(locale, "wor_payback")}</th>
                  <th scope="col"><span className="visually-hidden">{t(locale, "delete")}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ row, scenario, summary }) => (
                  <tr key={row.id} aria-current={row.id === opened?.id ? "true" : undefined}>
                    <td data-label={t(locale, "calc_name")}>
                      <Link href={`/invest/pro?calc=${row.id}`} className="link">{row.name}</Link>
                      <div className="cell-sub">{fmtDate.format(row.updatedAt)}</div>
                    </td>
                    <td data-label={t(locale, "calc_col_verdict")}>
                      <span className={VERDICT_BADGE[summary.verdict]}>{t(locale, `wor_verdict_${summary.verdict}`)}</span>
                    </td>
                    <td className="num" data-label={t(locale, "wor_price")}>{formatMoney(scenario.inputs.price, scenario.currency)}</td>
                    <td
                      className="num"
                      data-label={t(locale, "wor_cf_month")}
                      style={{ color: summary.cashFlowMonth >= 0 ? "var(--status-rented-text)" : "var(--status-danger-text)" }}
                    >
                      {formatMoney(summary.cashFlowMonth, scenario.currency)}
                    </td>
                    <td className="num" data-label={t(locale, "wor_coc")}>{summary.cocPct.toFixed(1)}%</td>
                    <td className="num" data-label={t(locale, "wor_cap")}>{summary.capRatePct.toFixed(1)}%</td>
                    <td className="num" data-label={t(locale, "wor_payback")}>{years(summary.paybackYears)}</td>
                    <td className="num">
                      {!readOnlyOperator(operator) && (
                        <ConfirmAction
                          action={deleteScenario}
                          undo={{ action: restoreScenario, label: t(locale, "decide_undo"), done: t(locale, "calc_deleted_undo") }}
                          fields={{ id: row.id }}
                          trigger={<IconClose size={15} />}
                          ariaLabel={`${t(locale, "delete")}: ${row.name}`}
                          question={t(locale, "calc_delete_q")}
                          confirmLabel={t(locale, "delete")}
                          cancelLabel={t(locale, "cancel")}
                          inline
                          after={row.id === opened?.id ? "/invest/pro" : undefined}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
