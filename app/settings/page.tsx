import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { toggleLocale } from "@/lib/i18n/actions";
import { updateProfileName } from "@/lib/account/actions";
import { getBillingContext } from "@/lib/billing/context";
import { planById, type AccountType } from "@/lib/billing/plans";
import ThemeToggle from "../theme-toggle";
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

  const fmtDate = new Intl.DateTimeFormat(locale === "ka" ? "ka-GE" : "en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  const isMember = operator.companyId != null;
  const accountType = (isMember ? "business" : operator.accountType) as AccountType;
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
    "team_invite", "team_invite_hint", "team_remove", "copy_link",
    "operator_email", "error_required", "error_limit_members",
    "error_owner_only", "save",
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
            <span className="flex flex-wrap items-center justify-end gap-2">
              <span className="badge badge--listed">{planLatin}</span>
              {operator.paidUntil && (
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {t(locale, "billing_paid_until")}: {fmtDate.format(operator.paidUntil)}
                </span>
              )}
              {!isMember && (
                <Link href="/billing" className="btn-chip">
                  {t(locale, "billing_upgrade")}
                </Link>
              )}
            </span>
          </div>
        </div>
      </section>

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
