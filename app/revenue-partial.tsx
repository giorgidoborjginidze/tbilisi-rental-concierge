import Link from "next/link";
import { t, type Locale } from "@/lib/i18n/strings";

/**
 * Booking revenue is only as complete as the prices on the stays: iCal
 * imports arrive without one. Say so, and where to add them. Renders
 * nothing when every sold night has a price.
 */
export default function RevenuePartial({ locale, nights }: { locale: Locale; nights: number }) {
  if (nights <= 0) return null;
  return (
    <p className="revenue-partial">
      {t(locale, "revenue_partial").replace("{n}", String(nights))}. {t(locale, "adr_priced_note")}{" "}
      <Link href="/bookings?show=unpriced" className="link">
        {t(locale, "revenue_partial_link")}
      </Link>
    </p>
  );
}
