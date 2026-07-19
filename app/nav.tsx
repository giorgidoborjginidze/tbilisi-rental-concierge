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

  const links = operator
    ? [
        { href: "/", label: t(locale, "nav_dashboard") },
        { href: "/units", label: t(locale, "nav_units") },
        { href: "/calendar", label: t(locale, "nav_calendar") },
        { href: "/pricing", label: t(locale, "nav_pricing") },
        { href: "/assets", label: t(locale, "nav_assets") },
        { href: "/alerts", label: t(locale, "nav_alerts") },
      ]
    : [];

  return (
    <nav className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-8 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <Link href="/" className="font-semibold">
            {t(locale, "appName")}
          </Link>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {operator && (
            <span className="hidden text-xs text-neutral-500 sm:inline">
              {operator.email}
            </span>
          )}
          <form action={toggleLocale}>
            <input type="hidden" name="locale" value={other} />
            <button
              type="submit"
              className="rounded border border-line-strong bg-white px-2 py-1 text-xs hover:bg-surface2"
            >
              {other === "ka" ? "ქართული" : "English"}
            </button>
          </form>
          {operator ? (
            <form action={logout}>
              <button
                type="submit"
                className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                {t(locale, "logout")}
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded border border-line-strong bg-white px-2 py-1 text-xs hover:bg-surface2"
            >
              {t(locale, "login_title")}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
