import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { toggleLocale } from "@/lib/i18n/actions";
import { updateProfileName } from "@/lib/account/actions";
import { getBillingContext } from "@/lib/billing/context";
import { plansFor, planById, type AccountType } from "@/lib/billing/plans";
import { isFlittSandbox } from "@/lib/billing/flitt";
import ThemeToggle from "../theme-toggle";
import PlanCards from "../billing/plan-cards";
import TeamSection from "../billing/team-section";

export const dynamic = "force-dynamic";

const PLAN_LATIN: Record<string, string> = {
  starter: "Starter", standard: "Standard", pro: "Pro",
  biz_s: "Business S", biz_m: "Business M",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const operator = await requireOperator();
  const locale = await getLocale();
  const other = locale === "en" ? "ka" : "en";
  const context = await getBillingContext(operator);
  const justReturned = (await searchParams).paid === "1";
  const sandbox = isFlittSandbox();

  const fmtDate = new Intl.DateTimeFormat(locale === "ka" ? "ka-GE" : "en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  const isMember = operator.companyId != null;
  const accountType = (isMember ? "business" : operator.accountType) as AccountType;
  const plans = plansFor(accountType);
  const planLatin = operator.plan
    ? PLAN_LATIN[operator.plan] ?? planById(operator.plan)?.id ?? "—"
    : "Trial";

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
    "error_owner_only", "save", "billing_pay", "error_payment",
  ];
  const labels = Object.fromEntries(labelKeys.map((k) => [k, t(locale, k)]));

  const row = { color: "var(--color-text-muted)" };

  return (
    <main>
      <h1>{t(locale, "settings_title")}</h1>

      {justReturned && (
        <div className="alert-card alert-card--underpriced">
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "billing_pay_return")}
          </div>
        </div>
      )}

      {/* ── Account ── */}
      <section style={{ marginTop: 8 }}>
        <h2>{t(locale, "settings_account")}</h2>
        <div className="card" style={{ marginTop: 12, padding: 18, display: "grid", gap: 14 }}>
          <form action={updateProfileName} className="flex flex-wrap items-end gap-3">
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              {t(locale, "operator_name")}
              <input name="name" defaultValue={operator.name ?? ""} placeholder="Activo" />
            </label>
            <button type="submit" className="btn-secondary">{t(locale, "save")}</button>
          </form>
          <div className="flex items-center justify-between gap-3">
            <span style={row}>{t(locale, "operator_email")}</span>
            <strong>{operator.email}</strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span style={row}>{t(locale, "billing_current")}</span>
            <span className="flex items-center gap-2">
              <span className="badge badge--listed">{planLatin}</span>
              {operator.paidUntil && (
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {t(locale, "billing_paid_until")}: {fmtDate.format(operator.paidUntil)}
                </span>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* ── Plan & Billing ── */}
      {isMember ? (
        <div className="alert-card alert-card--lease" style={{ marginTop: 20 }}>
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "billing_member_account")}
          </div>
        </div>
      ) : (
        <section>
          <h2>{t(locale, "billing_title")}</h2>

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

      {/* ── Team ── */}
      {context.isOwner && accountType === "business" && (
        <TeamSection
          members={members.map((m) => ({
            id: m.id, name: m.name, email: m.email,
            assets: m._count.assets, units: m._count.units,
          }))}
          invites={invites.map((invite) => ({ id: invite.id, email: invite.email, token: invite.token }))}
          heading={t(locale, "team_title")}
          membersHeading={t(locale, "team_members")}
          pendingHeading={t(locale, "team_pending")}
          labels={labels}
        />
      )}

      {/* ── Interface ── */}
      <section style={{ marginTop: 20 }}>
        <h2>{t(locale, "settings_interface")}</h2>
        <div className="card" style={{ marginTop: 12, padding: 18, display: "grid", gap: 14 }}>
          <div className="flex items-center justify-between gap-3">
            <span style={row}>{t(locale, "settings_language")}</span>
            <form action={toggleLocale}>
              <input type="hidden" name="locale" value={other} />
              <button type="submit" className="btn-chip">{locale === "ka" ? "KA" : "EN"}</button>
            </form>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span style={row}>{t(locale, "settings_theme")}</span>
            <ThemeToggle />
          </div>
        </div>
      </section>
    </main>
  );
}
