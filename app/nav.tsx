import Link from "next/link";
import { Suspense } from "react";
import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { toggleLocale } from "@/lib/i18n/actions";
import ThemeToggle from "./theme-toggle";
import ActivoLogo from "./activo-logo";
import AccountMenu from "./account-menu";
import NavMenu from "./nav-menu";
import NavLinks from "./nav-links";
import DemoRibbon from "./demo-ribbon";
import { alertBadge, workspaceNav } from "@/lib/nav/facts";
import type { NavEntry } from "@/lib/nav/model";
import { effectivePlan, planById, planStanding, trialDaysLeft, type AccountType } from "@/lib/billing/plans";

// Plan names always shown in Latin, per design.
const PLAN_LATIN: Record<string, string> = {
  starter: "Starter",
  standard: "Standard",
  pro: "Pro",
  biz_s: "Business S",
  biz_m: "Business M",
};

export default async function Nav() {
  const locale = await getLocale();
  const operator = await getSessionOperator();
  const other = locale === "en" ? "ka" : "en";

  // One navigation model for every surface (lib/nav/model.ts): a section
  // appears only when the workspace has it, and the top nav never holds
  // more than five entries. Help (lessons, tour, support, about, contact)
  // lives in the account menu.
  const model = operator ? await workspaceNav(operator.id, operator.profile) : null;
  const badge = operator ? await alertBadge(operator.id) : null;
  const entry = (item: NavEntry) => ({ href: item.href, label: t(locale, item.labelKey) });
  // The top nav's Alerts carries the same count as the phone's bell.
  const withBadge = (item: NavEntry) => {
    const plain = entry(item);
    if (item.key !== "alerts" || badge == null) return plain;
    return {
      ...plain,
      badge,
      badgeLabel:
        badge === "dot"
          ? t(locale, "nav_alerts_dot").replace("{label}", plain.label)
          : t(locale, "nav_alerts_badge").replace("{label}", plain.label).replace("{n}", String(badge)),
    };
  };

  // Signed out: informational only — the free calculator and the info pages.
  const infoLinks = [
    { href: "/learn", label: t(locale, "nav_learn") },
    { href: "/about", label: t(locale, "footer_about") },
    { href: "/contact", label: t(locale, "footer_contact") },
  ];
  const links = model
    ? model.top.map(withBadge)
    : [{ href: "/invest", label: t(locale, "nav_invest") }, ...infoLinks];

  return (
    <>
    <nav className="nav">
      <Link href="/" className="nav__brand" aria-label={t(locale, "appName")}>
        <ActivoLogo height={24} />
      </Link>
      <div className="nav__spacer" aria-hidden />
      <NavLinks
        className="nav__links nav__links--desktop nav__links--app"
        links={links}
      />
      <div className="nav__meta">
        <ThemeToggle label={t(locale, "aria_theme")} />
        <form action={toggleLocale}>
          <input type="hidden" name="locale" value={other} />
          <button
            type="submit"
            className="btn-chip"
            aria-label={t(locale, "aria_language_switch")}
            title={t(locale, "aria_language_switch")}
          >
            {locale === "ka" ? "KA" : "EN"}
          </button>
        </form>
        {operator ? (
          (() => {
            // The owner's own name, Georgian script included (ნინო → ნ).
            const username = operator.name?.trim() || operator.email.split("@")[0];
            // The plan in force: a bought plan only while it is paid.
            const now = new Date();
            const state = {
              accountType: operator.accountType as AccountType,
              plan: operator.plan,
              trialEndsAt: operator.trialEndsAt,
              paidUntil: operator.paidUntil,
              complimentary: operator.isDemo,
            };
            const standing = planStanding(state, now);
            const inForce = effectivePlan(state, now);
            const plan = operator.companyId
              ? "Team"
              : standing === "paid" || standing === "grace" || standing === "complimentary"
                ? PLAN_LATIN[inForce.id] ?? planById(inForce.id)?.id ?? "—"
                : trialDaysLeft(operator.trialEndsAt, now) > 0
                  ? "Trial"
                  : PLAN_LATIN[inForce.id] ?? inForce.id;
            return (
              <AccountMenu
                name={username}
                plan={plan}
                // Georgian letters stay as they are: upper-casing ნ gives the
                // Mtavruli Ნ, which reads as a different script in a badge.
                initial={
                  /[\u10D0-\u10FF]/.test(username.charAt(0))
                    ? username.charAt(0)
                    : username.charAt(0).toUpperCase()
                }
                mobileLinks={(model?.menuMobile ?? []).map(entry)}
                moreLinks={(model?.menuAlways ?? []).map(entry)}
                helpLinks={infoLinks}
                labels={{
                  settings: t(locale, "nav_settings"),
                  billing: t(locale, "nav_billing"),
                  logout: t(locale, "logout"),
                  help: t(locale, "nav_help"),
                  tour: t(locale, "help_tour"),
                  support: t(locale, "help_support"),
                }}
              />
            );
          })()
        ) : (
          <Link href="/login" className="btn-chip nav__desktop-only">
            {t(locale, "login_title")}
          </Link>
        )}
      </div>
      {/* Signed-out visitors keep a plain hamburger; signed-in users get
          their navigation inside the unified account menu instead. */}
      {!operator && (
        <NavMenu
          links={links}
          signIn={{ href: "/login", label: t(locale, "login_title") }}
          menuLabel={t(locale, "aria_menu")}
        />
      )}
    </nav>
    {operator?.isDemo && (
      <Suspense fallback={null}>
        <DemoRibbon
          labels={{
            ribbon: t(locale, "demo_ribbon"),
            readonly: t(locale, "demo_readonly"),
            cta: t(locale, "demo_register_cta"),
            close: t(locale, "bot_close"),
          }}
        />
      </Suspense>
    )}
    </>
  );
}
