import Link from "next/link";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { toggleLocale } from "@/lib/i18n/actions";
import { planById } from "@/lib/billing/plans";
import ThemeToggle from "../theme-toggle";

export const dynamic = "force-dynamic";

const PLAN_LATIN: Record<string, string> = {
  starter: "Starter",
  standard: "Standard",
  pro: "Pro",
  biz_s: "Business S",
  biz_m: "Business M",
};

export default async function SettingsPage() {
  const operator = await requireOperator();
  const locale = await getLocale();
  const other = locale === "en" ? "ka" : "en";

  const rawName = operator.name?.trim() || operator.email.split("@")[0];
  const username = /^[\x00-\x7F]+$/.test(rawName) ? rawName : operator.email.split("@")[0];
  const plan = operator.plan
    ? PLAN_LATIN[operator.plan] ?? planById(operator.plan)?.id ?? "—"
    : "Trial";

  return (
    <main>
      <h1>{t(locale, "settings_title")}</h1>

      <section style={{ marginTop: 8 }}>
        <h2>{t(locale, "settings_account")}</h2>
        <div className="card" style={{ marginTop: 12, padding: 18, display: "grid", gap: 12 }}>
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: "var(--color-text-muted)" }}>{t(locale, "operator_name")}</span>
            <strong>{username}</strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: "var(--color-text-muted)" }}>{t(locale, "operator_email")}</span>
            <strong>{operator.email}</strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: "var(--color-text-muted)" }}>{t(locale, "billing_current")}</span>
            <span className="flex items-center gap-2">
              <span className="badge badge--listed">{plan}</span>
              <Link href="/billing" className="link">{t(locale, "settings_manage_plan")}</Link>
            </span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>{t(locale, "settings_interface")}</h2>
        <div className="card" style={{ marginTop: 12, padding: 18, display: "grid", gap: 14 }}>
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: "var(--color-text-muted)" }}>{t(locale, "settings_language")}</span>
            <form action={toggleLocale}>
              <input type="hidden" name="locale" value={other} />
              <button type="submit" className="btn-chip">{locale === "ka" ? "KA" : "EN"}</button>
            </form>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: "var(--color-text-muted)" }}>{t(locale, "settings_theme")}</span>
            <ThemeToggle />
          </div>
        </div>
      </section>
    </main>
  );
}
