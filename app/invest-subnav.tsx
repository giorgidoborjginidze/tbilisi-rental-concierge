import Link from "next/link";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";

// Sub-tabs of the "Investment" section: the free calculator and the PRO
// analysis. Same pattern as RentalsSubnav, so the two paid/free halves
// are one click apart instead of buried behind a promo banner.
export default async function InvestSubnav({
  active,
}: {
  active: "calc" | "pro";
}) {
  const locale = await getLocale();
  const tabs = [
    { key: "calc", href: "/invest", label: t(locale, "invest_nav_calc") },
    { key: "pro", href: "/invest/pro", label: t(locale, "invest_nav_pro") },
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
          {tab.key === "pro" && (
            <span className="badge badge--listed" style={{ marginLeft: 6, fontSize: 10 }}>
              PRO
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
