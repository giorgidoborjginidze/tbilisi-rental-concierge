import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { PLANS, planStanding } from "@/lib/billing/plans";
import { formatMoney } from "@/lib/format";
import { tbilisiFormat } from "@/lib/time";
import { PlanForm, ResetLinkForm } from "./forms";

// Accounts, by hand: while online payment and email are switched off,
// "write to us" is answered here — a plan for some months, or a one-time
// password link to send over WhatsApp. Only for ADMIN_EMAILS.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Accounts · Activo", robots: { index: false, follow: false } };

const LABEL_KEYS: StringKey[] = [
  "admin_email", "admin_plan", "admin_plan_none", "admin_months", "admin_plan_save", "admin_link_make",
  "admin_copy", "admin_copied", "admin_plan_given", "admin_plan_ended", "admin_link_made",
  "admin_err_account", "admin_err_member", "admin_err_plan", "admin_err_months",
];

export default async function AccountsAdminPage() {
  await requireAdmin();
  const locale = await getLocale();
  const labels = Object.fromEntries(LABEL_KEYS.map((key) => [key, t(locale, key)]));
  const plans = PLANS.map((plan) => ({
    id: plan.id,
    label: `${plan.id} · ${plan.kind === "business" ? t(locale, "admin_kind_business") : t(locale, "admin_kind_personal")} · ${formatMoney(plan.priceGel)}`,
  }));
  const recent = await prisma.operator.findMany({
    where: { isDemo: false, companyId: null },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { email: true, name: true, accountType: true, plan: true, trialEndsAt: true, paidUntil: true, createdAt: true },
  });
  const now = new Date();
  const fmt = tbilisiFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <main>
      <h1>{t(locale, "admin_accounts_title")}</h1>
      <p className="page-lead">{t(locale, "admin_accounts_lead")}</p>
      <p className="field-hint">
        <Link href="/admin/market" className="link">{t(locale, "market_title")}</Link>
      </p>

      <section style={{ marginTop: 18 }}>
        <h2>{t(locale, "admin_plan_title")}</h2>
        <p className="field-hint" style={{ margin: "0 0 10px" }}>{t(locale, "admin_plan_hint")}</p>
        <PlanForm labels={labels} plans={plans} />
      </section>

      <section style={{ marginTop: 22 }}>
        <h2>{t(locale, "admin_link_title")}</h2>
        <p className="field-hint" style={{ margin: "0 0 10px" }}>{t(locale, "admin_link_hint")}</p>
        <ResetLinkForm labels={labels} />
      </section>

      <section style={{ marginTop: 22 }}>
        <h2>{t(locale, "admin_recent")}</h2>
        <div className="card table-stack">
          <table>
            <thead>
              <tr>
                <th scope="col">{t(locale, "admin_email")}</th>
                <th scope="col">{t(locale, "admin_plan")}</th>
                <th scope="col">{t(locale, "admin_until")}</th>
                <th scope="col">{t(locale, "admin_joined")}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => {
                const standing = planStanding(
                  {
                    accountType: row.accountType === "business" ? "business" : "personal",
                    plan: row.plan,
                    trialEndsAt: row.trialEndsAt,
                    paidUntil: row.paidUntil,
                  },
                  now,
                );
                const onTrial = standing === "none" && row.trialEndsAt != null && row.trialEndsAt > now;
                const shown = onTrial ? "trial" : standing;
                const until = standing === "paid" || standing === "grace" ? row.paidUntil : onTrial ? row.trialEndsAt : null;
                return (
                  <tr key={row.email}>
                    <td className="table-stack__title">
                      {row.email}
                      {row.name && <div className="cell-sub">{row.name}</div>}
                    </td>
                    <td data-label={t(locale, "admin_plan")}>{row.plan ?? "—"} · {t(locale, `admin_standing_${shown}` as StringKey)}</td>
                    <td data-label={t(locale, "admin_until")}>{until ? fmt.format(until) : "—"}</td>
                    <td data-label={t(locale, "admin_joined")}>{fmt.format(row.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
