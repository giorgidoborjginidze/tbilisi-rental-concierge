import Link from "next/link";
import { t, type Locale } from "@/lib/i18n/strings";

/**
 * Booking revenue is only as complete as the prices on the stays: iCal
 * imports arrive without one. Say so, and where to add them. Renders
 * nothing when every sold night has a price. `month` ("YYYY-MM") links to
 * that month's unpriced stays; `adr` adds the line on how ADR counts
 * (only where ADR is shown).
 */
export default function RevenuePartial({
  locale,
  nights,
  month,
  adr = true,
}: {
  locale: Locale;
  nights: number;
  month?: string;
  adr?: boolean;
}) {
  if (nights <= 0) return null;
  return (
    <p className="revenue-partial">
      {t(locale, "revenue_partial").replace("{n}", String(nights))}.{" "}
      {adr && <>{t(locale, "adr_priced_note")} </>}
      <Link href={`/bookings?show=unpriced${month ? `&month=${month}` : ""}`} className="link">
        {t(locale, "revenue_partial_link")}
      </Link>
    </p>
  );
}

/** "YYYY-MM" of a month's first day (stored form, UTC midnight). */
export const monthKeyOf = (start: Date) => start.toISOString().slice(0, 7);
