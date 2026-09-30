import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import RentalsSubnav from "../rentals-subnav";
import { firstParam, type QueryValue } from "@/lib/params";
import { LIVE_STAY } from "@/lib/bookings/live";
import { BOOKINGS_PAGE_SIZE, monthRange, pageFromQuery, pageSlices } from "@/lib/bookings/list";
import { titled } from "@/lib/i18n/metadata";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("bookings_title");

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
  if (source === "lease") return t(locale, "overlap_src_lease");
  return t(locale, source === "direct" ? "source_direct" : "source_manual");
}

// Every stay the owner may still need to touch: current and upcoming FIRST
// (they are the ones that still need a price), then the last 60 days —
// with its price, or "no price" for iCal imports (the channels do not send
// one), and a way to add it, fix the guest name or cancel. "No price" lists
// every unpriced stay, however old; `month` narrows the list to one month
// (the analytics table links its "partial" months here). Long lists page.
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: QueryValue; unit?: QueryValue; month?: QueryValue; page?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const locale = await getLocale();
  const query = await searchParams;
  const showParam = firstParam(query.show);
  const unitParam = firstParam(query.unit);
  const month = monthRange(firstParam(query.month));
  const show: Show = SHOWS.includes(showParam as Show) ? (showParam as Show) : "all";

  const today = startOfTodayTbilisi();
  const since = new Date(today.getTime() - LOOKBACK_DAYS * DAY_MS);
  const unitScope = { unit: { operatorId: operator.id, ...(unitParam ? { id: unitParam } : {}) } };
  const dates = month
    ? { checkIn: { lt: month.end }, checkOut: { gt: month.start } }
    : show === "unpriced"
      ? {}
      : { checkOut: { gt: since } };
  const unpricedWhere = { ...unitScope, ...LIVE_STAY, amount: null };
  const where = {
    ...unitScope,
    ...dates,
    ...(show === "cancelled"
      ? { status: "cancelled" }
      : show === "unpriced"
        ? { ...LIVE_STAY, amount: null }
        : { status: { not: "cancelled" } }),
  };
  // Upcoming (not checked out yet) first, soonest first; then the past,
  // newest first.
  const upcomingWhere = { AND: [where, { checkOut: { gt: today } }] };
  const pastWhere = { AND: [where, { checkOut: { lte: today } }] };
  const [upcomingCount, pastCount, unpricedCount] = await Promise.all([
    prisma.booking.count({ where: upcomingWhere }),
    prisma.booking.count({ where: pastWhere }),
    prisma.booking.count({ where: month ? { ...unpricedWhere, ...dates } : unpricedWhere }),
  ]);
  const total = upcomingCount + pastCount;
  const page = pageFromQuery(firstParam(query.page), total);
  const slices = pageSlices(page, upcomingCount);
  const include = { unit: { select: { id: true, name: true, nameKa: true } } };
  const [upcoming, past] = await Promise.all([
    slices.first.take > 0
      ? prisma.booking.findMany({
          where: upcomingWhere,
          include,
          orderBy: [{ checkIn: "asc" }, { id: "asc" }],
          skip: slices.first.skip,
          take: slices.first.take,
        })
      : [],
    slices.second.take > 0
      ? prisma.booking.findMany({
          where: pastWhere,
          include,
          orderBy: [{ checkIn: "desc" }, { id: "asc" }],
          skip: slices.second.skip,
          take: slices.second.take,
        })
      : [],
  ]);
  const bookings = [...upcoming, ...past];
  const firstRow = total === 0 ? 0 : page * BOOKINGS_PAGE_SIZE + 1;
  const lastRow = page * BOOKINGS_PAGE_SIZE + bookings.length;

  const day = tbilisiFormat(locale, { day: "numeric", month: "short" });
  const unitName = (unit: { name: string; nameKa: string | null }) =>
    locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;
  const monthKey = firstParam(query.month);
  const suffix = `${unitParam ? `&unit=${encodeURIComponent(unitParam)}` : ""}${month && monthKey ? `&month=${monthKey}` : ""}`;
  const monthLabel = month
    ? tbilisiFormat(locale, { month: "long", year: "numeric" }).format(month.start)
    : null;
  const pageHref = (target: number) => `/bookings?show=${show}${suffix}&page=${target + 1}`;
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
        {monthLabel ? (
          <>
            {t(locale, "bookings_scope_month").replace("{month}", monthLabel)}{" "}
            <Link
              href={`/bookings?show=${show}${unitParam ? `&unit=${encodeURIComponent(unitParam)}` : ""}`}
              className="link"
            >
              {t(locale, "bookings_all_dates")}
            </Link>
          </>
        ) : (
          t(locale, show === "unpriced" ? "bookings_scope_unpriced" : "bookings_scope_note")
        )}
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
                const mirror = !cancelled && booking.mirrorOf != null;
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
                      {mirror && (
                        <div className="cell-sub" title={t(locale, "booking_mirror_note")}>
                          {t(locale, "booking_mirror_of").replace(
                            "{source}",
                            sourceName(locale, booking.mirrorOf as string),
                          )}
                        </div>
                      )}
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
                      ) : mirror ? (
                        <span className="cell-sub">{t(locale, "booking_mirror_short")}</span>
                      ) : (
                        <span className="price-missing">{t(locale, "booking_no_price")}</span>
                      )}
                    </td>
                    <td className="num">
                      <Link href={`/bookings/${booking.id}/edit`} className="link">
                        {booking.amount == null && !cancelled && !mirror
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
      {total > bookings.length && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="field-hint" style={{ margin: 0 }}>
            {t(locale, "bookings_showing")
              .replace("{from}", String(firstRow))
              .replace("{to}", String(lastRow))
              .replace("{total}", String(total))}
          </span>
          {page > 0 && (
            <Link href={pageHref(page - 1)} className="btn-chip">
              {t(locale, "bookings_prev")}
            </Link>
          )}
          {lastRow < total && (
            <Link href={pageHref(page + 1)} className="btn-chip">
              {t(locale, "bookings_next")}
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
