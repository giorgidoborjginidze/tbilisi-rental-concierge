import Link from "next/link";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";

// Sub-tabs of the "Rentals" section: units / calendar / pricing / analytics.
export default async function RentalsSubnav({
  active,
}: {
  active: "units" | "calendar" | "pricing" | "analytics";
}) {
  const locale = await getLocale();
  const tabs = [
    { key: "units", href: "/units", label: t(locale, "nav_units") },
    { key: "calendar", href: "/calendar", label: t(locale, "nav_calendar") },
    { key: "pricing", href: "/pricing", label: t(locale, "nav_pricing") },
    { key: "analytics", href: "/analytics", label: t(locale, "nav_analytics") },
  ] as const;

  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={"btn-chip " + (tab.key === active ? "btn-chip--active" : "")}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
