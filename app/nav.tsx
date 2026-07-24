import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { toggleLocale } from "@/lib/i18n/actions";
import ThemeToggle from "./theme-toggle";
import ActivoLogo from "./activo-logo";
import AccountMenu from "./account-menu";
import NavMenu from "./nav-menu";
import { planById } from "@/lib/billing/plans";

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
        { href: "/", label: t(locale, "nav_dashboard") },
        { href: "/invest", label: t(locale, "nav_invest") },
      ];

  // Marketing/info links live by the logo on the left; the app links move
  // to the right, next to the theme/language/account controls.
  const infoLinks = [
    { href: "/about", label: t(locale, "footer_about") },
    { href: "/contact", label: t(locale, "footer_contact") },
  ];
  const menuLinks = [...links, ...infoLinks];

  return (
    <nav className="nav">
      <Link href="/" className="nav__brand" aria-label={t(locale, "appName")}>
        <ActivoLogo height={24} />
      </Link>
      <div className="nav__links nav__links--desktop nav__links--info">
        {infoLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
      <div className="nav__spacer" aria-hidden />
      <div className="nav__links nav__links--desktop nav__links--app">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
      <div className="nav__meta">
        <ThemeToggle />
        <form action={toggleLocale}>
          <input type="hidden" name="locale" value={other} />
          <button type="submit" className="btn-chip" aria-label="Language" title="Language">
            {locale === "ka" ? "KA" : "EN"}
          </button>
        </form>
        {operator ? (
          (() => {
            const rawName = operator.name?.trim() || operator.email.split("@")[0];
            // Always Latin: fall back to the email local-part for non-Latin names.
            const username = /^[\x00-\x7F]+$/.test(rawName)
              ? rawName
              : operator.email.split("@")[0];
            const plan = operator.plan
              ? PLAN_LATIN[operator.plan] ?? planById(operator.plan)?.id ?? "—"
              : "Trial";
            return (
              <AccountMenu
                name={username}
                plan={plan}
                initial={username.charAt(0).toUpperCase()}
                links={menuLinks}
                labels={{
                  settings: t(locale, "nav_settings"),
                  billing: t(locale, "nav_billing"),
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
        />
      )}
    </nav>
  );
}
