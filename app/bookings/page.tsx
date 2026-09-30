import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import RentalsSubnav from "../rentals-subnav";
import { firstParam, type QueryValue } from "@/lib/params";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
/** How far back the list reaches: long enough to add last month's prices. */
const LOOKBACK_DAYS = 60;

type Show = "all" | "unpriced" | "cancelled";
const SHOWS: Show[] = ["all", "unpriced", "cancelled"];

const money = (value: number, currency: string) =>
  `${Math.round(value).toLocaleString("en-US")} ${currency}`;

function sourceName(locale: Locale, source: string): string {
  if (source === "airbnb") return "Airbnb";
  if (source === "booking") return "Booking.com";
  return t(locale, source === "direct" ? "source_direct" : "source_manual");
}

// Every stay the owner may still need to touch: current and upcoming, and
// the last 60 days — with its price, or "no price" for iCal imports (the
// channels do not send one), and a way to add it, fix the guest name or
// cancel.
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: QueryValue; unit?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const locale = await getLocale();
  const query = await searchParams;
  const showParam = firstParam(query.show);
  const unitParam = firstParam(query.unit);
  const show: Show = SHOWS.includes(showParam as Show) ? (showParam as Show) : "all";

  const since = new Date(startOfTodayTbilisi().getTime() - LOOKBACK_DAYS * DAY_MS);
  const scope = {
    unit: { operatorId: operator.id, ...(unitParam ? { id: unitParam } : {}) },
    checkOut: { gt: since },
  };
  const [bookings, unpricedCount] = await Promise.all([
    prisma.booking.findMany({
      where: {
        ...scope,
        ...(show === "cancelled"
          ? { status: "cancelled" }
          : { status: { not: "cancelled" }, ...(show === "unpriced" ? { amount: null } : {}) }),
      },
      include: { unit: { select: { id: true, name: true, nameKa: true } } },
      orderBy: { checkIn: "asc" },
      take: 400,
    }),
    prisma.booking.count({
      where: { ...scope, status: { not: "cancelled" }, amount: null },
    }),
  ]);

  const day = tbilisiFormat(locale, { day: "numeric", month: "short" });
  const unitName = (unit: { name: string; nameKa: string | null }) =>
    locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;
  const suffix = unitParam ? `&unit=${unitParam}` : "";
  const chipLabel: Record<Show, StringKey> = {
    all: "bookings_filter_all",
    unpriced: "bookings_filter_unpriced",
    cancelled: "bookings_filter_cancelled",
  };

  return (
    <main>
      <RentalsSubnav active="bookings" />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "bookings_title")}</h1>
        <Link href="/bookings/new" className="btn-secondary">
          {t(locale, "bookings_add")}
        </Link>
      </div>
      <p className="field-hint" style={{ marginTop: 0 }}>
        {t(locale, "bookings_scope_note")}
      </p>

      {unpricedCount > 0 && show !== "unpriced" && (
        <p className="revenue-partial" style={{ marginBottom: 10 }}>
          {t(locale, "bookings_unpriced_hint").replace("{n}", String(unpricedCount))}{" "}
          <Link href={`/bookings?show=unpriced${suffix}`} className="link">
            {t(locale, "revenue_partial_link")}
          </Link>
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {SHOWS.map((key) => (
          <Link
            key={key}
            href={`/bookings?show=${key}${suffix}`}
            className={"btn-chip " + (key === show ? "btn-chip--active" : "")}
          >
            {t(locale, chipLabel[key])}
            {key === "unpriced" && unpricedCount > 0 ? ` (${unpricedCount})` : ""}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "bookings_empty")}</p>
      ) : (
        <div className="card card--stack">
          <table>
            <thead>
              <tr>
                <th>{t(locale, "booking_unit")}</th>
                <th>{t(locale, "booking_dates")}</th>
                <th>{t(locale, "dash_guest")}</th>
                <th className="num">{t(locale, "booking_price")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const cancelled = booking.status === "cancelled";
                return (
                  <tr key={booking.id} className={cancelled ? "booking-cancelled" : undefined}>
                    <td>
                      <Link
                        href={`/calendar?unit=${booking.unit.id}&month=${booking.checkIn.toISOString().slice(0, 7)}`}
                        className="link"
                      >
                        {unitName(booking.unit)}
                      </Link>
                      <div className="cell-sub">{sourceName(locale, booking.source)}</div>
                    </td>
                    <td data-label={t(locale, "booking_dates")}>
                      {day.format(booking.checkIn)} – {day.format(booking.checkOut)}
                      <div className="cell-sub">
                        {booking.nights} {t(locale, "nights_short")}
                      </div>
                    </td>
                    <td data-label={t(locale, "dash_guest")}>
                      {booking.guestName ?? "—"}
                      {cancelled && booking.cancelReason && (
                        <div className="cell-sub">
                          {t(locale, "booking_status_cancelled")} ·{" "}
                          {t(locale, `booking_cancel_reason_${booking.cancelReason}` as StringKey)}
                        </div>
                      )}
                    </td>
                    <td className="num" data-label={t(locale, "booking_price")}>
                      {booking.amount != null ? (
                        money(booking.amount, booking.currency)
                      ) : (
                        <span className="price-missing">{t(locale, "booking_no_price")}</span>
                      )}
                    </td>
                    <td className="num">
                      <Link href={`/bookings/${booking.id}/edit`} className="link">
                        {booking.amount == null && !cancelled
                          ? t(locale, "booking_add_price")
                          : t(locale, "edit")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
