import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { getBillingContext } from "@/lib/billing/context";
import { graceEndsAt, plansFor, type AccountType } from "@/lib/billing/plans";
import { flittConfig, isFlittSandbox } from "@/lib/billing/flitt";
import { CONTACT_EMAIL } from "@/lib/contact";
import { tbilisiFormat } from "@/lib/time";
import PlanCards from "./plan-cards";
import PaymentPending from "./payment-status";
import { titled } from "@/lib/i18n/metadata";

// Plan & subscription lives on its own page ("Upgrade Plan") rather than
// inside Settings, so upgrading is one click from the account menu.
export const dynamic = "force-dynamic";

export const generateMetadata = titled("billing_title");

const PLAN_LATIN: Record<string, string> = {
  starter: "Starter", standard: "Standard", pro: "Pro",
  biz_s: "Business S", biz_m: "Business M",
};

/** A pending checkout older than this was abandoned; it is not listed. */
const STALE_PENDING_MS = 2 * 3_600_000;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const operator = await requireOperator();
  const locale = await getLocale();
  const context = await getBillingContext(operator);
  const query = await searchParams;
  const orderParam = typeof query.order === "string" ? query.order : null;
  const legacyReturn = query.paid === "1";
  const cfg = flittConfig();
  const checkoutOff = cfg == null;
  const sandbox = isFlittSandbox(cfg);
  const now = new Date();

  const fmtDate = tbilisiFormat(locale, { day: "numeric", month: "long", year: "numeric" });
  const fill = (key: StringKey, values: Record<string, string>) =>
    Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, v), t(locale, key));

  const isMember = operator.companyId != null;
  const accountType = (isMember ? "business" : operator.accountType) as AccountType;
  const plans = plansFor(accountType);

  // Back from the payment page: this order's real status, never a blanket
  // "thanks". (An older link without an order id shows the latest attempt.)
  const returned =
    orderParam || legacyReturn
      ? await prisma.payment.findFirst({
          where: {
            operatorId: operator.id,
            ...(orderParam
              ? { orderId: orderParam }
              : { createdAt: { gte: new Date(now.getTime() - STALE_PENDING_MS) } }),
          },
          orderBy: { createdAt: "desc" },
        })
      : null;

  const history = isMember
    ? []
    : await prisma.payment.findMany({
        where: {
          operatorId: operator.id,
          OR: [
            { status: { in: ["approved", "declined"] } },
            { createdAt: { gte: new Date(now.getTime() - STALE_PENDING_MS) } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      });

  const labelKeys: StringKey[] = [
    "billing_current", "per_month",
    "billing_assets", "billing_units", "billing_members",
    "plan_starter", "plan_standard", "plan_pro", "plan_biz_s", "plan_biz_m",
    "billing_analysis", "billing_pay", "billing_renew", "error_payment",
    "error_payment_unavailable", "error_required",
  ];
  const labels = Object.fromEntries(labelKeys.map((k) => [k, t(locale, k)]));
  const planName = (id: string | null) => (id ? PLAN_LATIN[id] ?? id : "—");

  const returnBlock = (() => {
    if (!orderParam && !legacyReturn) return null;
    if (!returned) {
      return (
        <div className="alert-card alert-card--gap" role="status">
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {fill("billing_ret_unknown", { email: CONTACT_EMAIL })}
          </div>
        </div>
      );
    }
    if (returned.status === "approved") {
      return (
        <div className="alert-card alert-card--underpriced" role="status">
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {fill("billing_ret_approved", {
              plan: planName(returned.plan),
              date: context.paidUntil ? fmtDate.format(context.paidUntil) : "—",
            })}
          </div>
        </div>
      );
    }
    if (returned.status === "declined") {
      return (
        <div className="alert-card alert-card--overdue" role="alert">
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "billing_ret_declined")}
          </div>
        </div>
      );
    }
    return (
      <PaymentPending
        waiting={t(locale, "billing_ret_pending")}
        long={fill("billing_ret_pending_long", { email: CONTACT_EMAIL })}
      />
    );
  })();

  // Where the bought plan stands.
  const standingBlock = (() => {
    const chosen = context.chosenPlan;
    if (context.standing === "paid" && context.paidUntil) {
      return (
        <p className="billing-standing">
          {t(locale, "billing_paid_until")}: <strong>{fmtDate.format(context.paidUntil)}</strong>
          {" · "}
          {fill("billing_extends", { date: fmtDate.format(context.paidUntil) })}
        </p>
      );
    }
    if (context.standing === "grace" && context.paidUntil) {
      return (
        <div className="alert-card alert-card--gap">
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {fill("billing_grace", {
              date: fmtDate.format(context.paidUntil),
              grace: fmtDate.format(graceEndsAt(context.paidUntil)),
            })}
          </div>
        </div>
      );
    }
    if (context.standing === "expired" && chosen && context.trialDaysLeft === 0) {
      return (
        <div className="alert-card alert-card--gap">
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {fill("billing_expired", {
              plan: planName(chosen),
              date: context.paidUntil ? fmtDate.format(context.paidUntil) : "—",
            })}
          </div>
        </div>
      );
    }
    if (context.standing === "none" && context.trialDaysLeft === 0) {
      return (
        <div className="alert-card alert-card--gap">
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "billing_trial_over")}
          </div>
        </div>
      );
    }
    return null;
  })();

  return (
    <main>
      <h1>{t(locale, "billing_upgrade")}</h1>

      {returnBlock}

      {isMember ? (
        <div className="alert-card alert-card--lease" style={{ marginTop: 20 }}>
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "billing_member_account")}
          </div>
        </div>
      ) : (
        <section>
          {context.trialDaysLeft > 0 && context.standing !== "paid" && (
            <div className="alert-card alert-card--underpriced" style={{ alignItems: "center" }}>
              <div className="alert-card__title">
                {t(locale, "billing_trial")}: {context.trialDaysLeft} {t(locale, "days_left")}
              </div>
              <span className="badge badge--rented">
                {t(locale, `plan_${context.plan.id}` as StringKey)}
              </span>
            </div>
          )}
          {standingBlock}

          <div className="kpi-grid kpi-grid--3d" style={{ margin: "14px 0 8px" }}>
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

          {checkoutOff ? (
            <div className="alert-card alert-card--gap" style={{ marginTop: 8 }} role="note">
              <div className="alert-card__detail" style={{ marginTop: 0 }}>
                {fill("billing_unavailable", { email: CONTACT_EMAIL })}
              </div>
            </div>
          ) : sandbox ? (
            <div className="alert-card alert-card--gap" style={{ marginTop: 8 }}>
              <div className="alert-card__title">{t(locale, "billing_sandbox")}</div>
              <div className="alert-card__detail" style={{ marginTop: 4 }}>
                {t(locale, "billing_sandbox_card")}
              </div>
            </div>
          ) : null}

          <div data-tour="plans">
          <PlanCards
            plans={plans.map((plan) => ({
              id: plan.id, priceGel: plan.priceGel,
              maxAssets: plan.maxAssets, maxUnits: plan.maxUnits, maxMembers: plan.maxMembers,
              isBusiness: plan.kind === "business", analysis: plan.analysis,
            }))}
            currentPlan={context.standing === "none" ? null : context.chosenPlan}
            effectivePlanId={context.plan.id}
            checkoutOff={checkoutOff || operator.isDemo}
            labels={labels}
          />
          </div>

          {history.length > 0 && (
            <section style={{ marginTop: 22 }}>
              <h2>{t(locale, "billing_history")}</h2>
              <ul className="card billing-history">
                {history.map((payment) => (
                  <li key={payment.id}>
                    <span>{fmtDate.format(payment.paidAt ?? payment.createdAt)}</span>
                    <span>{planName(payment.plan)}</span>
                    <span>{(payment.amountMinor / 100).toFixed(2)} {payment.currency}</span>
                    <span className={`badge ${payment.status === "approved" ? "badge--rented" : payment.status === "declined" ? "badge--vacant" : "badge--listed"}`}>
                      {t(locale, `pay_status_${payment.status === "approved" || payment.status === "declined" ? payment.status : "pending"}` as StringKey)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      )}
    </main>
  );
}
