import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
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

  // The Rentals section follows the workspace profile: hotels always see
  // it, brokerages and car rentals never do (they work in Assets),
  // personal accounts see it once they actually have a rentable unit.
  const showRentals = operator
    ? operator.profile === "hotel" ||
      (!["brokerage", "car_rental"].includes(operator.profile) &&
        (await prisma.unit.count({ where: { operatorId: operator.id } })) > 0)
    : false;

  // Signed in: grouped sections (rentals gets sub-tabs on its pages).
  // Signed out: informational only — home and the free calculator.
  const links = operator
    ? [
        { href: "/", label: t(locale, "nav_dashboard") },
        ...(showRentals
          ? [{ href: "/units", label: t(locale, "nav_rentals") }]
          : []),
        { href: "/assets", label: t(locale, "nav_assets") },
        { href: "/invest", label: t(locale, "nav_invest") },
        { href: "/alerts", label: t(locale, "nav_alerts") },
      ]
    : [
        // Signed out: no Dashboard — it just lands back on this same page.
        { href: "/invest", label: t(locale, "nav_invest") },
      ];

  // Marketing/info links live by the logo on the left; the app links move
  // to the right, next to the theme/language/account controls.
  const infoLinks = [
    { href: "/learn", label: t(locale, "nav_learn") },
    { href: "/about", label: t(locale, "footer_about") },
    { href: "/contact", label: t(locale, "footer_contact") },
  ];
  const menuLinks = [...links, ...infoLinks];

  return (
    <>
    <nav className="nav">
      <Link href="/" className="nav__brand" aria-label={t(locale, "appName")}>
        <ActivoLogo height={24} />
      </Link>
      <div className="nav__spacer" aria-hidden />
      <NavLinks
        className="nav__links nav__links--desktop nav__links--app"
        links={[...links, ...infoLinks]}
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
                links={menuLinks}
                labels={{
                  settings: t(locale, "nav_settings"),
                  billing: t(locale, "billing_upgrade"),
                  logout: t(locale, "logout"),
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
          links={menuLinks}
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
