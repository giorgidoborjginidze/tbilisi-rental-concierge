import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getBillingContext } from "@/lib/billing/context";
import { plansFor, type AccountType } from "@/lib/billing/plans";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import PlanCards from "./plan-cards";
import TeamSection from "./team-section";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const operator = await requireOperator();
  const locale = await getLocale();
  const context = await getBillingContext(operator);

  const isMember = operator.companyId != null;
  const accountType = (isMember ? "business" : operator.accountType) as AccountType;
  const plans = plansFor(accountType);

  const [members, invites] = context.isOwner && accountType === "business"
    ? await Promise.all([
        prisma.operator.findMany({
          where: { companyId: operator.id },
          select: { id: true, name: true, email: true, _count: { select: { assets: true, units: true } } },
          orderBy: { createdAt: "asc" },
        }),
        prisma.invite.findMany({
          where: { companyId: operator.id, usedAt: null },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], []];

  const labelKeys: StringKey[] = [
    "billing_choose", "billing_chosen", "billing_current", "per_month",
    "billing_assets", "billing_units", "billing_members",
    "plan_starter", "plan_standard", "plan_pro", "plan_biz_s", "plan_biz_m",
    "team_invite", "team_invite_hint", "team_remove", "copy_link", "billing_analysis",
    "operator_email", "error_required", "error_limit_members",
    "error_owner_only", "save",
  ];
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(locale, key)]));

  return (
    <main>
      <h1>{t(locale, "billing_title")}</h1>
      <p className="mb-5" style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 640 }}>
        {t(locale, "billing_intro")}
      </p>

      {isMember && (
        <div className="alert-card alert-card--lease">
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "billing_member_account")}
          </div>
        </div>
      )}

      {!isMember && context.trialDaysLeft > 0 && (
        <div className="alert-card alert-card--underpriced" style={{ alignItems: "center" }}>
          <div className="alert-card__title">
            {t(locale, "billing_trial")}: {context.trialDaysLeft} {t(locale, "days_left")}
          </div>
          <span className="badge badge--rented">
            {t(locale, `plan_${context.plan.id}` as StringKey)}
          </span>
        </div>
      )}
      {!isMember && context.trialDaysLeft === 0 && !operator.plan && (
        <div className="alert-card alert-card--gap">
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "billing_trial_over")}
          </div>
        </div>
      )}

      <section>
        <h2>{t(locale, "usage_title")}</h2>
        <div className="kpi-grid" style={{ margin: "14px 0 8px" }}>
          <div className="kpi">
            <div className="kpi__label">{t(locale, "billing_current")}</div>
            <div className="kpi__value">
              {t(locale, `plan_${context.plan.id}` as StringKey)}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi__label">{t(locale, "nav_assets")}</div>
            <div className="kpi__value">
              {context.assetCount} / {context.plan.maxAssets}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi__label">{t(locale, "nav_units")}</div>
            <div className="kpi__value">
              {context.unitCount} / {context.plan.maxUnits}
            </div>
          </div>
          {accountType === "business" && (
            <div className="kpi">
              <div className="kpi__label">{t(locale, "team_members")}</div>
              <div className="kpi__value">
                {context.memberCount} / {context.plan.maxMembers}
              </div>
            </div>
          )}
        </div>
      </section>

      {!isMember && (
        <PlanCards
          plans={plans.map((plan) => ({
            id: plan.id,
            priceGel: plan.priceGel,
            maxAssets: plan.maxAssets,
            maxUnits: plan.maxUnits,
            maxMembers: plan.maxMembers,
            isBusiness: plan.kind === "business",
            analysis: plan.analysis,
          }))}
          currentPlan={operator.plan}
          effectivePlanId={context.plan.id}
          labels={labels}
        />
      )}

      {context.isOwner && accountType === "business" && (
        <TeamSection
          members={members.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            assets: m._count.assets,
            units: m._count.units,
          }))}
          invites={invites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            token: invite.token,
          }))}
          heading={t(locale, "team_title")}
          membersHeading={t(locale, "team_members")}
          pendingHeading={t(locale, "team_pending")}
          labels={labels}
        />
      )}
    </main>
  );
}
