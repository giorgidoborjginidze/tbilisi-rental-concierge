import Link from "next/link";
import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { toggleLocale } from "@/lib/i18n/actions";
import { logout } from "@/lib/auth/actions";

export default async function Nav() {
  const locale = await getLocale();
  const operator = await getSessionOperator();
  const other = locale === "en" ? "ka" : "en";

  // Signed in: grouped sections (rentals gets sub-tabs on its pages).
  // Signed out: informational only — home and the free calculator.
  const links = operator
    ? [
        { href: "/", label: t(locale, "nav_dashboard") },
        { href: "/units", label: t(locale, "nav_rentals") },
        { href: "/assets", label: t(locale, "nav_assets") },
        { href: "/invest", label: t(locale, "nav_invest") },
        { href: "/alerts", label: t(locale, "nav_alerts") },
      ]
    : [
        { href: "/", label: t(locale, "nav_dashboard") },
        { href: "/invest", label: t(locale, "nav_invest") },
      ];

  return (
    <nav className="nav">
      <Link href="/" className="nav__brand">
        {t(locale, "appName")}
      </Link>
      <div className="nav__links">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
      <div className="nav__meta">
        {operator && <span className="hidden sm:inline">{operator.email}</span>}
        {operator && (
          <Link href="/billing" className="btn-chip">
            {t(locale, "nav_billing")}
          </Link>
        )}
        <form action={toggleLocale}>
          <input type="hidden" name="locale" value={other} />
          <button type="submit" className="btn-chip">
            {other === "ka" ? "ქართული" : "English"}
          </button>
        </form>
        {operator ? (
          <form action={logout}>
            <button type="submit" className="btn-chip">
              {t(locale, "logout")}
            </button>
          </form>
        ) : (
          <Link href="/login" className="btn-chip">
            {t(locale, "login_title")}
          </Link>
        )}
      </div>
    </nav>
  );
}
