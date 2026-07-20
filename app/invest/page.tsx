import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { KNOWN_DISTRICTS } from "@/lib/types";
import { PRICE_PER_SQM } from "@/lib/invest/market";
import Calculator from "./calculator";

export const dynamic = "force-dynamic";

const LABEL_KEYS: StringKey[] = [
  "invest_title", "invest_intro", "inv_params", "inv_district", "inv_area",
  "inv_price", "inv_price_hint", "inv_renovation", "renov_none",
  "renov_cosmetic", "renov_medium", "renov_full", "inv_renov_cost",
  "inv_rent", "inv_rent_hint", "inv_vacancy", "inv_tax", "inv_financing",
  "inv_use_loan", "inv_down_payment", "inv_rate", "inv_term_years",
  "inv_deposit_rate", "inv_results", "res_total_investment",
  "res_cash_invested", "res_monthly_payment", "res_total_loan_cost",
  "res_net_income", "res_cash_flow", "res_gross_yield", "res_net_yield",
  "res_payback", "res_cash_payback", "res_years", "res_never",
  "res_deposit_income", "res_verdict_good", "res_verdict_ok",
  "res_verdict_poor", "invest_disclaimer",
];

export default async function InvestPage() {
  await requireOperator();

  const locale = await getLocale();
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  // District rent benchmarks for the current month (mock-seeded table).
  const rows = await prisma.rentBenchmark.findMany({
    where: { month: monthKey, district: { in: [...KNOWN_DISTRICTS] } },
  });
  const rentPerSqm = Object.fromEntries(
    rows.map((row) => [row.district, row.avgRentPerSqm]),
  );

  const labels = Object.fromEntries(
    LABEL_KEYS.map((key) => [key, t(locale, key)]),
  );

  return (
    <main>
      <h1>{t(locale, "invest_title")}</h1>
      <p className="mb-5" style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 640 }}>
        {t(locale, "invest_intro")}
      </p>

      <div className="alert-card alert-card--contract" style={{ alignItems: "center", marginBottom: 20 }}>
        <div>
          <div className="alert-card__title">
            {t(locale, "wor_title")} <span className="badge badge--listed">PRO</span>
          </div>
          <div className="alert-card__detail">{t(locale, "wor_teaser")}</div>
        </div>
        <Link href="/invest/pro" className="btn-primary" style={{ whiteSpace: "nowrap" }}>
          {t(locale, "wor_open")}
        </Link>
      </div>
      <Calculator
        districts={[...KNOWN_DISTRICTS]}
        rentPerSqm={rentPerSqm}
        pricePerSqm={PRICE_PER_SQM}
        labels={labels}
      />
    </main>
  );
}
