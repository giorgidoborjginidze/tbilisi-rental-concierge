import Link from "next/link";
import { requireOperator } from "@/lib/auth/session";
import { getBillingContext } from "@/lib/billing/context";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import ProCalculator from "./pro-calculator";

export const dynamic = "force-dynamic";

const LABEL_KEYS: StringKey[] = [
  "wor_intro", "wor_deal", "wor_price", "wor_equity", "wor_other_costs",
  "wor_rate", "wor_years", "wor_rent", "wor_growth", "wor_vacancy",
  "wor_more", "wor_insurance", "wor_maintenance", "wor_management",
  "wor_utilities", "wor_broker", "wor_hoa", "wor_proptax", "wor_points",
  "wor_tax", "wor_units_n", "wor_currency",
  "wor_verdict_good", "wor_verdict_ok", "wor_verdict_poor",
  "wor_payment", "wor_invested", "wor_cf_month", "wor_coc", "wor_cap",
  "wor_payback", "wor_equity5", "wor_year", "wor_col_rent", "wor_col_noi",
  "wor_col_cf", "wor_col_coc", "wor_col_equity", "wor_note",
  "res_years", "res_never",
];

export default async function ProAnalysisPage() {
  const operator = await requireOperator();
  const locale = await getLocale();
  const context = await getBillingContext(operator);

  if (!context.plan.analysis) {
    return (
      <main>
        <h1>{t(locale, "wor_title")}</h1>
        <div className="alert-card alert-card--contract" style={{ display: "block", maxWidth: 640 }}>
          <p className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "wor_locked")}
          </p>
          <div style={{ marginTop: 14 }}>
            <Link href="/billing" className="btn-primary">
              {t(locale, "nav_billing")} →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const labels = Object.fromEntries(
    LABEL_KEYS.map((key) => [key, t(locale, key)]),
  );

  return (
    <main>
      <div className="flex flex-wrap items-center gap-2">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "wor_title")}</h1>
        <span className="badge badge--listed">PRO</span>
      </div>
      <p className="mb-5" style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 640, marginTop: 8 }}>
        {t(locale, "wor_intro")}
      </p>
      <ProCalculator labels={labels} />
    </main>
  );
}
