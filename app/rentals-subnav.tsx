import Link from "next/link";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";

// Sub-tabs of the Rentals section: the calendar (its landing page — with
// the free windows and their suggested prices), the units, the analytics.
// The bookings list and the day-by-day price table open from the calendar
// and light its tab.
export default async function RentalsSubnav({
  active,
}: {
  active: "calendar" | "units" | "analytics";
}) {
  const locale = await getLocale();
  const tabs = [
    { key: "calendar", href: "/calendar", label: t(locale, "nav_calendar") },
    { key: "units", href: "/units", label: t(locale, "nav_units") },
    { key: "analytics", href: "/analytics", label: t(locale, "nav_analytics") },
  ] as const;

  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={"btn-chip " + (tab.key === active ? "btn-chip--active" : "")}
          aria-current={tab.key === active ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
