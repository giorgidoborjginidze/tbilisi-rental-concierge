import { monthKeyTbilisi, monthStartTbilisi, tbilisiFormat } from "@/lib/time";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { KNOWN_DISTRICTS } from "@/lib/types";
import { marketFigures, summarizeSources } from "@/lib/market/figures";
import Calculator from "./calculator";
import CarCalculator from "./car-calculator";
import FlipCalculator from "./flip-calculator";
import InvestTabs from "./invest-tabs";
import InvestSubnav from "../invest-subnav";
import { districtLabel } from "@/lib/places";
import { titled } from "@/lib/i18n/metadata";
import { getSessionOperator } from "@/lib/auth/session";
import { firstParam, type QueryValue } from "@/lib/params";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("invest_title", { alternates: { canonical: "/invest" } });

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
  "res_deposit_income", "res_deposit_own", "res_verdict_basis", "res_years_over",
  "inv_upkeep", "res_verdict_good", "res_verdict_ok",
  "res_verdict_poor", "invest_disclaimer",
  "car_title", "car_intro", "car_model", "car_custom", "car_price",
  "car_daily", "car_days", "car_costs", "car_costs_hint",
  "car_compare_title", "car_market_price", "car_market_rate",
  "car_vs_market_below", "car_vs_market_above", "car_vs_market_at",
  "car_monthly_income", "car_gross", "car_annual_yield", "car_market_hint",
  "car_intro", "car_mode_rental", "car_mode_taxi", "taxi_title", "taxi_intro",
  "taxi_gross_day", "taxi_days", "taxi_platform", "taxi_platform_hint",
  "taxi_fuel_day", "taxi_service", "taxi_insurance", "taxi_depreciation",
  "taxi_depreciation_hint", "taxi_driver_share", "taxi_driver_share_hint",
  "taxi_res_cash", "taxi_res_net", "taxi_res_net_hint", "taxi_res_gross",
  "taxi_res_costs", "taxi_res_yield", "taxi_res_payback", "taxi_vs_rental",
  "taxi_res_yield_hint", "taxi_verdict_good", "taxi_verdict_ok", "taxi_verdict_poor", "taxi_verdict_basis",
  "taxi_vs_taxi_better", "taxi_vs_rental_better", "taxi_vs_equal", "taxi_vs_hint",
  "taxi_c_platform", "taxi_c_fuel", "taxi_c_running", "taxi_c_driver",
  "flip_title", "flip_intro", "flip_price", "flip_renovation",
  "flip_buying_costs", "flip_holding_cost", "flip_holding_cost_hint",
  "flip_months", "flip_sale_price", "flip_selling_fee", "flip_tax",
  "flip_res_invested", "flip_res_holding", "flip_res_net_proceeds",
  "flip_res_selling_fee", "flip_res_profit", "flip_res_tax", "flip_res_roi",
  "flip_res_annual", "flip_res_per_month", "flip_res_breakeven",
  "flip_res_breakeven_hint", "flip_verdict_good", "flip_verdict_ok", "flip_verdict_poor",
  "flip_verdict_basis",
];

const TABS = ["re", "car", "flip"] as const;
type InvestTab = (typeof TABS)[number];

export default async function InvestPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: QueryValue }>;
}) {
  const locale = await getLocale();
  // ?tab=car opens a calculator directly; a car rental's own "Invest" opens
  // on the car calculator (its tab bar seat and top-nav entry lead here).
  const requested = firstParam((await searchParams).tab);
  const operator = await getSessionOperator();
  const initialTab: InvestTab = TABS.includes(requested as InvestTab)
    ? (requested as InvestTab)
    : operator?.profile === "car_rental"
      ? "car"
      : "re";
  const monthKey = monthKeyTbilisi();

  // District rent and sale prices per m²: market figures where there are
  // any (reports, listings, Activo's own data), else the built-in estimates.
  const [rentFigures, saleFigures] = await Promise.all([
    marketFigures(KNOWN_DISTRICTS, "rent_sqm", monthKey),
    marketFigures(KNOWN_DISTRICTS, "sale_sqm", monthKey),
  ]);
  const rentPerSqm = Object.fromEntries(Object.entries(rentFigures).map(([district, answer]) => [district, Math.round(answer.value * 10) / 10]));
  const pricePerSqm = Object.fromEntries(Object.entries(saleFigures).map(([district, answer]) => [district, Math.round(answer.value)]));
  // Which sources stand behind the prefilled figures, named once for the page.
  const sourceLine = summarizeSources([...Object.values(rentFigures), ...Object.values(saleFigures)], {
    listings: t(locale, "market_from_listings"),
    activo: t(locale, "market_from_activo"),
  });

  const labels = Object.fromEntries(
    LABEL_KEYS.map((key) => [key, t(locale, key)]),
  );
  // The prefilled figures are Activo's estimates for this month — say so,
  // with the month, instead of passing them off as market data.
  // With real figures behind some districts, the note names them instead.
  labels.invest_disclaimer = (sourceLine
    ? t(locale, "invest_disclaimer_market").replace("{sources}", sourceLine)
    : labels.invest_disclaimer
  ).replace("{month}", tbilisiFormat(locale, { month: "long", year: "numeric" }).format(monthStartTbilisi(0)));

  return (
    <main>
      <h1>{t(locale, "invest_title")}</h1>
      <InvestSubnav active="calc" />

      <InvestTabs
        initial={initialTab}
        reLabel={t(locale, "invest_tab_re")}
        carLabel={t(locale, "invest_tab_car")}
        flipLabel={t(locale, "invest_tab_flip")}
        realEstate={
          <>
            {/* The buy-to-let intro belongs to its own tab; the car and flip
                calculators carry their own. */}
            <p className="mb-5" style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 640 }}>
              {t(locale, "invest_intro")}
            </p>
            <Calculator
              districts={KNOWN_DISTRICTS.map((value) => ({ value, label: districtLabel(locale, value) }))}
              rentPerSqm={rentPerSqm}
              pricePerSqm={pricePerSqm}
              labels={labels}
            />
          </>
        }
        car={<CarCalculator labels={labels} />}
        flip={<FlipCalculator labels={labels} />}
      />
    </main>
  );
}
