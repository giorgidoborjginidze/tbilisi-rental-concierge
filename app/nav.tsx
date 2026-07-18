import Link from "next/link";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { toggleLocale } from "@/lib/i18n/actions";

export default async function Nav() {
  const locale = await getLocale();
  const other = locale === "en" ? "ka" : "en";

  const links = [
    { href: "/", label: t(locale, "nav_dashboard") },
    { href: "/units", label: t(locale, "nav_units") },
  ];

  return (
    <nav className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-3">
        <div className="flex items-center gap-6">
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
        <form action={toggleLocale}>
          <input type="hidden" name="locale" value={other} />
          <button
            type="submit"
            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {other === "ka" ? "ქართული" : "English"}
          </button>
        </form>
      </div>
    </nav>
  );
}
