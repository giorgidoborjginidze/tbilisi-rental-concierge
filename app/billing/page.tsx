import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { getBillingContext } from "@/lib/billing/context";
import { plansFor, type AccountType } from "@/lib/billing/plans";
import { isFlittSandbox } from "@/lib/billing/flitt";
import PlanCards from "./plan-cards";

// Plan & subscription lives on its own page ("Upgrade Plan") rather than
// inside Settings, so upgrading is one click from the account menu.
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const operator = await requireOperator();
  const locale = await getLocale();
  const context = await getBillingContext(operator);
  const justReturned = (await searchParams).paid === "1";
  const sandbox = isFlittSandbox();

  const isMember = operator.companyId != null;
  const accountType = (isMember ? "business" : operator.accountType) as AccountType;
  const plans = plansFor(accountType);

  const labelKeys: StringKey[] = [
    "billing_choose", "billing_chosen", "billing_current", "per_month",
    "billing_assets", "billing_units", "billing_members",
    "plan_starter", "plan_standard", "plan_pro", "plan_biz_s", "plan_biz_m",
    "billing_analysis", "billing_pay", "error_payment",
  ];
  const labels = Object.fromEntries(labelKeys.map((k) => [k, t(locale, k)]));

  return (
    <main>
      <h1>{t(locale, "billing_upgrade")}</h1>

      {justReturned && (
        <div className="alert-card alert-card--underpriced">
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "billing_pay_return")}
          </div>
        </div>
      )}

      {isMember ? (
        <div className="alert-card alert-card--lease" style={{ marginTop: 20 }}>
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "billing_member_account")}
          </div>
        </div>
      ) : (
        <section>
          {context.trialDaysLeft > 0 && (
            <div className="alert-card alert-card--underpriced" style={{ alignItems: "center" }}>
              <div className="alert-card__title">
                {t(locale, "billing_trial")}: {context.trialDaysLeft} {t(locale, "days_left")}
              </div>
              <span className="badge badge--rented">
                {t(locale, `plan_${context.plan.id}` as StringKey)}
              </span>
            </div>
          )}
          {context.trialDaysLeft === 0 && !operator.plan && (
            <div className="alert-card alert-card--gap">
              <div className="alert-card__detail" style={{ marginTop: 0 }}>
                {t(locale, "billing_trial_over")}
              </div>
            </div>
          )}

          <div className="kpi-grid" style={{ margin: "14px 0 8px" }}>
            <div className="kpi">
              <div className="kpi__label">{t(locale, "nav_assets")}</div>
              <div className="kpi__value">{context.assetCount} / {context.plan.maxAssets}</div>
            </div>
            <div className="kpi">
              <div className="kpi__label">{t(locale, "nav_units")}</div>
              <div className="kpi__value">{context.unitCount} / {context.plan.maxUnits}</div>
            </div>
            {accountType === "business" && (
              <div className="kpi">
                <div className="kpi__label">{t(locale, "team_members")}</div>
                <div className="kpi__value">{context.memberCount} / {context.plan.maxMembers}</div>
              </div>
            )}
          </div>

          {sandbox && (
            <div className="alert-card alert-card--gap" style={{ marginTop: 8 }}>
              <div className="alert-card__title">{t(locale, "billing_sandbox")}</div>
              <div className="alert-card__detail" style={{ marginTop: 4 }}>
                {t(locale, "billing_sandbox_card")}
              </div>
            </div>
          )}

          <PlanCards
            plans={plans.map((plan) => ({
              id: plan.id, priceGel: plan.priceGel,
              maxAssets: plan.maxAssets, maxUnits: plan.maxUnits, maxMembers: plan.maxMembers,
              isBusiness: plan.kind === "business", analysis: plan.analysis,
            }))}
            currentPlan={operator.plan}
            effectivePlanId={context.plan.id}
            labels={labels}
          />
        </section>
      )}
    </main>
  );
}
