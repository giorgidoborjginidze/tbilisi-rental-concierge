import { prisma } from "@/lib/db";
import { LegalNote } from "../legal-doc";
import Kpi from "../kpi";
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
import { badgeClass, PAYMENT_STATUS_TONE, toneOf } from "@/lib/ui/tone";
import { formatMoney } from "@/lib/format";
import { Notice, SeverityIcon } from "../alert-icon";

// Plan & subscription lives on its own page ("Upgrade Plan") rather than
// inside Settings, so upgrading is one click from the account menu.
export const dynamic = "force-dynamic";

export const generateMetadata = titled("nav_billing");

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
        <Notice severity="warn" role="status">
          {fill("billing_ret_unknown", { email: CONTACT_EMAIL })}
        </Notice>
      );
    }
    if (returned.status === "approved") {
      return (
        <Notice severity="good" role="status">
          {fill("billing_ret_approved", {
            plan: planName(returned.plan),
            date: context.paidUntil ? fmtDate.format(context.paidUntil) : "—",
          })}
        </Notice>
      );
    }
    if (returned.status === "declined") {
      return (
        <Notice severity="danger" role="alert">
          {t(locale, "billing_ret_declined")}
        </Notice>
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
          <br />
          <span className="billing-standing__note">
            {fill("billing_switch_note", { plan: planName(chosen) })}
          </span>
        </p>
      );
    }
    if (context.standing === "grace" && context.paidUntil) {
      return (
        <Notice severity="warn">
          {fill("billing_grace", {
            date: fmtDate.format(context.paidUntil),
            grace: fmtDate.format(graceEndsAt(context.paidUntil)),
          })}
        </Notice>
      );
    }
    if (context.standing === "expired" && chosen && context.trialDaysLeft === 0) {
      return (
        <Notice severity="warn">
          {fill("billing_expired", {
            plan: planName(chosen),
            date: context.paidUntil ? fmtDate.format(context.paidUntil) : "—",
          })}
        </Notice>
      );
    }
    if (context.standing === "none" && context.trialDaysLeft === 0) {
      return (
        <Notice severity="warn">
          {t(locale, "billing_trial_over")}
        </Notice>
      );
    }
    return null;
  })();

  return (
    <main>
      {/* The page the menu's "Plan & billing" opens carries that name. */}
      <h1>{t(locale, "nav_billing")}</h1>

      {returnBlock}

      {isMember ? (
        <Notice severity="info" style={{ marginTop: 20 }}>
          {t(locale, "billing_member_account")}
        </Notice>
      ) : (
        <section>
          {context.trialDaysLeft > 0 && context.standing !== "paid" && (
            <div className="alert-card alert-card--good alert-card--middle">
              <div className="alert-card__title">
                <SeverityIcon severity="good" />
                {t(locale, "billing_trial")}: {context.trialDaysLeft} {t(locale, "days_left")}
              </div>
              <span className={badgeClass("good")}>
                {t(locale, `plan_${context.plan.id}` as StringKey)}
              </span>
            </div>
          )}
          {standingBlock}
          {context.plan.id === "free" && (
            // No trial, nothing paid: the free allowance, said plainly.
            <Notice severity="info" role="note" style={{ marginTop: 8 }}>
              {t(locale, "billing_free_note")
                .replace("{assets}", String(context.plan.maxAssets))
                .replace("{units}", String(context.plan.maxUnits))}
            </Notice>
          )}

          {/* As many columns as tiles, so the row ends where the cards do. */}
          <div
            className={`kpi-grid kpi-grid--3d ${accountType === "business" ? "kpi-grid--3" : "kpi-grid--2"}`}
            style={{ margin: "14px 0" }}
          >
            <Kpi label={t(locale, "nav_assets")} value={`${context.assetCount} / ${context.plan.maxAssets}`} />
            <Kpi label={t(locale, "nav_units")} value={`${context.unitCount} / ${context.plan.maxUnits}`} />
            {accountType === "business" && (
              <Kpi label={t(locale, "team_members")} value={`${context.memberCount} / ${context.plan.maxMembers}`} />
            )}
          </div>

          {checkoutOff ? (
            <Notice severity="warn" role="note" style={{ marginTop: 8 }}>
              {fill("billing_unavailable", { email: CONTACT_EMAIL })}
            </Notice>
          ) : sandbox ? (
            <div className="alert-card alert-card--warn" style={{ marginTop: 8 }}>
              <div>
              <div className="alert-card__title">
                <SeverityIcon severity="warn" />
                {t(locale, "billing_sandbox")}
              </div>
              <div className="alert-card__detail" style={{ marginTop: 4 }}>
                {t(locale, "billing_sandbox_card")}
              </div>
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
          {!checkoutOff && !operator.isDemo && (
            <p className="hint" style={{ marginTop: 10 }}>
              <LegalNote text={t(locale, "billing_terms_note")} />
            </p>
          )}

          {history.length > 0 && (
            <section style={{ marginTop: 22 }}>
              <h2>{t(locale, "billing_history")}</h2>
              <ul className="card billing-history">
                {history.map((payment) => (
                  <li key={payment.id}>
                    <span>{fmtDate.format(payment.paidAt ?? payment.createdAt)}</span>
                    <span>{planName(payment.plan)}</span>
                    <span>{formatMoney(payment.amountMinor / 100, payment.currency, "auto")}</span>
                    <span className={badgeClass(toneOf(PAYMENT_STATUS_TONE, payment.status === "approved" || payment.status === "declined" ? payment.status : "pending"))}>
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
