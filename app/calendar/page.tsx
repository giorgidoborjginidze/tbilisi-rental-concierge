import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { startOfTodayTbilisi } from "@/lib/time";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import {
  findGaps,
  findOverlaps,
  type Stay,
} from "@/lib/calendar/occupancy";
import UnitFilter from "./unit-filter";
import RentalsSubnav from "../rentals-subnav";
import { firstParam, type QueryValue } from "@/lib/params";
import { LIVE_STAY } from "@/lib/bookings/live";
import { titled } from "@/lib/i18n/metadata";
import { AlertTypeIcon } from "../alert-icon";
import { formatMoney } from "@/lib/format";
import { IconAlert, IconArrowRight, IconChevronLeft, IconChevronRight } from "../icons";
import { getMarketDataSource } from "@/lib/market/source";
import { benchmarkMonth, freeWindowRange, occupancyShare, windowPrice } from "@/lib/pricing/nightly";

export const dynamic = "force-dynamic";

// The Rentals section's landing page: its title is the nav entry's name.
export const generateMetadata = titled("nav_rentals");

const DAY_MS = 86_400_000;

const KIND_CLASS: Record<string, string> = {
  airbnb: "cal-cell--airbnb",
  booking: "cal-cell--booking",
  direct: "cal-cell--direct",
  manual: "cal-cell--direct",
  lease: "cal-cell--lease",
};
const OVERLAP_CLASS = "cal-cell--overlap";
const SOURCE_NAME: Record<string, string> = { airbnb: "Airbnb", booking: "Booking.com" };

function parseMonth(value: string | undefined): { year: number; month: number } {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  const today = startOfTodayTbilisi();
  return { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 };
}

/** Day numbers on a phone are marked every five days (CSS hides the rest). */
const dayNumClass = (day: number) =>
  day === 1 || day % 5 === 0 ? "cal-daynum cal-daynum--tick" : "cal-daynum";

const monthParam = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: QueryValue; unit?: QueryValue }>;
}) {
  const operator = await requireOperator();

  const locale = await getLocale();
  const query = await searchParams;
  const monthQuery = firstParam(query.month);
  const unitQuery = firstParam(query.unit);
  const { year, month } = parseMonth(monthQuery);

  const windowStart = new Date(Date.UTC(year, month - 1, 1));
  const windowEnd = new Date(Date.UTC(year, month, 1));
  const daysInMonth = Math.round(
    (windowEnd.getTime() - windowStart.getTime()) / DAY_MS,
  );

  const units = await prisma.unit.findMany({
    where: {
      operatorId: operator.id,
      ...(unitQuery ? { id: unitQuery } : {}),
    },
    orderBy: [{ city: "asc" }, { district: "asc" }, { name: "asc" }],
    include: {
      bookings: {
        where: {
          ...LIVE_STAY,
          checkIn: { lt: windowEnd },
          checkOut: { gt: windowStart },
        },
      },
      leases: {
        where: { startDate: { lt: windowEnd }, endDate: { gt: windowStart } },
      },
    },
  });

  const allUnits = unitQuery
    ? await prisma.unit.findMany({
        where: { operatorId: operator.id },
        orderBy: [{ city: "asc" }, { name: "asc" }],
        select: { id: true, name: true, nameKa: true },
      })
    : units;

  const today = startOfTodayTbilisi();

  const rows = units.map((unit) => {
    const stays: Stay[] = [
      ...unit.bookings.map((b) => ({
        id: b.id,
        kind: b.source,
        start: b.checkIn,
        end: b.checkOut,
      })),
      ...unit.leases.map((l) => ({
        id: l.id,
        kind: "lease",
        start: l.startDate,
        end: l.endDate,
      })),
    ];

    // Day-level occupancy for the grid: which stays cover each night.
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayStart = new Date(windowStart.getTime() + i * DAY_MS);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const covering = stays.filter((s) => s.start < dayEnd && s.end > dayStart);
      return {
        className:
          covering.length > 1
            ? OVERLAP_CLASS
            : covering.length === 1
              ? KIND_CLASS[covering[0].kind] ?? KIND_CLASS.direct
              : "",
      };
    });

    return {
      unit,
      days,
      overlaps: findOverlaps(stays),
    };
  });

  // ── Free windows worth acting on — from today on, two nights or more
  // (lib/pricing/nightly.ts freeWindowRange) — each with a suggested price:
  // the same rule-based engine as the day-by-day price table (/pricing),
  // without its written explanation: seasonality, the unit's own demand
  // over the next 30 nights, and the district's average nightly price. ──
  const range = freeWindowRange({ start: windowStart, end: windowEnd }, today);
  const aheadEnd = range
    ? new Date(Math.max(range.end.getTime(), today.getTime() + 30 * DAY_MS))
    : today;
  const [aheadBookings, aheadLeases] = range
    ? await Promise.all([
        prisma.booking.findMany({
          where: {
            unitId: { in: units.map((unit) => unit.id) },
            ...LIVE_STAY,
            checkIn: { lt: aheadEnd },
            checkOut: { gt: today },
          },
          select: { unitId: true, checkIn: true, checkOut: true },
        }),
        prisma.lease.findMany({
          where: {
            unitId: { in: units.map((unit) => unit.id) },
            startDate: { lt: aheadEnd },
            endDate: { gt: today },
          },
          select: { unitId: true, startDate: true, endDate: true },
        }),
      ])
    : [[], []];
  const aheadOf = (unitId: string) => [
    ...aheadBookings
      .filter((booking) => booking.unitId === unitId)
      .map((booking) => ({ start: booking.checkIn, end: booking.checkOut })),
    ...aheadLeases
      .filter((lease) => lease.unitId === unitId)
      .map((lease) => ({ start: lease.startDate, end: lease.endDate })),
  ];
  const gapsOf = new Map(
    rows.map((row) => [row.unit.id, range ? findGaps(aheadOf(row.unit.id), range, 2) : []]),
  );
  const market = getMarketDataSource();
  const benchmarkCache = new Map<string, number | null>();
  const benchmarksFor = async (district: string | null, nights: Date[]) => {
    const byMonth = new Map<string, number | null>();
    for (const month of new Set(nights.map(benchmarkMonth))) {
      const key = `${district ?? ""}|${month}`;
      if (!benchmarkCache.has(key)) {
        benchmarkCache.set(key, district ? (await market.getBenchmark(district, month))?.adr ?? null : null);
      }
      byMonth.set(month, benchmarkCache.get(key) ?? null);
    }
    return byMonth;
  };
  const priced = await Promise.all(
    rows.map(async (row) => {
      const occupancy = occupancyShare(aheadOf(row.unit.id), today, 30);
      return Promise.all(
        (gapsOf.get(row.unit.id) ?? []).map(async (gap) => {
          const nights = Array.from({ length: gap.nights }, (_, i) => new Date(gap.start.getTime() + i * DAY_MS));
          const benchmarks = await benchmarksFor(row.unit.district, nights);
          return windowPrice(row.unit, gap, occupancy, benchmarks);
        }),
      );
    }),
  );
  // Each free night's suggested price, for the grid's hover text.
  const nightPrice = new Map<string, number>();
  rows.forEach((row, r) =>
    priced[r].forEach((window) =>
      window?.nights.forEach((night) => nightPrice.set(`${row.unit.id}|${night.date.getTime()}`, night.rate)),
    ),
  );

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const unitSuffix = unitQuery ? `&unit=${unitQuery}` : "";

  const intl = locale === "ka" ? "ka-GE" : "en-GB";
  const monthLabel = new Intl.DateTimeFormat(intl, {
    month: "long",
    year: "numeric",
  }).format(windowStart);
  const fmtDay = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" });

  const displayName = (unit: { name: string; nameKa: string | null }) =>
    locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;

  const legend: { label: string; color: string; bordered?: boolean; overlap?: boolean }[] = [
    { label: "Airbnb", color: "var(--cal-airbnb)" },
    { label: "Booking.com", color: "var(--cal-booking)" },
    { label: t(locale, "calendar_direct_manual"), color: "var(--cal-direct)" },
    { label: t(locale, "calendar_lease"), color: "var(--cal-lease)" },
    { label: t(locale, "calendar_overlap"), color: "", overlap: true },
    { label: t(locale, "calendar_vacant"), color: "var(--cal-vacant)", bordered: true },
  ];

  return (
    <main>
      <RentalsSubnav active="calendar" />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "nav_rentals")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/bookings" className="btn-chip">
            {t(locale, "calendar_all_bookings")}
          </Link>
          <Link
            href={unitQuery ? `/bookings/new?unit=${unitQuery}` : "/bookings/new"}
            className="btn-secondary"
          >
            {t(locale, "bookings_add")}
          </Link>
        </div>
      </div>
      {allUnits.length === 0 ? (
        <div className="alert-card alert-card--info" style={{ alignItems: "center" }}>
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "calendar_no_units")}
          </div>
          <Link href="/units/new" className="btn-primary btn-compact">
            {t(locale, "units_add")}
          </Link>
        </div>
      ) : (
      <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="cal-month" style={{ margin: 0 }}>{monthLabel}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <UnitFilter
            units={allUnits.map((u) => ({ id: u.id, label: displayName(u) }))}
            selected={unitQuery ?? ""}
            allLabel={t(locale, "calendar_all_units")}
          />
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?month=${monthParam(prev.year, prev.month)}${unitSuffix}`}
              className="btn-chip btn-chip--icon"
              aria-label={t(locale, "calendar_prev_month")}
              title={t(locale, "calendar_prev_month")}
            >
              <IconChevronLeft size={16} />
            </Link>
            <Link
              href={`/calendar?month=${monthParam(next.year, next.month)}${unitSuffix}`}
              className="btn-chip btn-chip--icon"
              aria-label={t(locale, "calendar_next_month")}
              title={t(locale, "calendar_next_month")}
            >
              <IconChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="legend">
        {legend.map((item) =>
          item.overlap ? (
            // A double booking: hatched red and named with a warning icon,
            // so it never rests on telling two reds apart.
            <span key={item.label} className="legend__overlap">
              <i className="cal-swatch--overlap" />
              <IconAlert size={14} />
              {item.label}
            </span>
          ) : (
            <span key={item.label}>
              <i
                style={{
                  background: item.color,
                  border: item.bordered ? "1px solid var(--color-border)" : undefined,
                }}
              />
              {item.label}
            </span>
          ),
        )}
      </div>

      <div
        className="card cal-board"
        style={{ "--days": daysInMonth } as React.CSSProperties}
      >
        <span className="cal-name cal-name--head" />
        {Array.from({ length: daysInMonth }, (_, i) => (
          <span key={`h${i}`} className={dayNumClass(i + 1)}>
            {i + 1}
          </span>
        ))}
        {rows.map(({ unit, days }) => (
          <Fragment key={unit.id}>
            <span className="cal-name">
              <Link
                href={`/calendar?month=${monthParam(year, month)}&unit=${unit.id}`}
                title={displayName(unit)}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {displayName(unit)}
              </Link>
            </span>
            {days.map((day, i) => {
              const night = windowStart.getTime() + i * DAY_MS;
              const rate = day.className ? undefined : nightPrice.get(`${unit.id}|${night}`);
              return (
                <span
                  key={i}
                  className={`cal-cell ${day.className}`}
                  title={
                    rate != null
                      ? `${fmtDay.format(new Date(night))} — ${t(locale, "calendar_cell_free")} · ${formatMoney(rate, unit.currency)}`
                      : undefined
                  }
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      {/* A double booking first — it costs money today. */}
      <section style={{ marginTop: 28 }}>
        <h2>{t(locale, "calendar_overlaps")}</h2>
        {rows.every((r) => r.overlaps.length === 0) ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "calendar_no_overlaps")}</p>
        ) : (
          rows.flatMap(({ unit, overlaps }) =>
            overlaps.map((overlap, i) => (
              <div key={`${unit.id}-${i}`} className="alert-card alert-card--danger">
                <div>
                  <div className="alert-card__title">
                    <AlertTypeIcon type="overlap" />
                    {displayName(unit)}{" "}
                    <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-text-muted)" }}>
                      ({overlap.kinds.join(" + ")})
                    </span>
                  </div>
                  <div className="alert-card__detail">
                    {fmtDay.format(overlap.start)} – {fmtDay.format(overlap.end)} ·{" "}
                    {overlap.nights} {t(locale, "nights_short")}
                  </div>
                </div>
              </div>
            )),
          )
        )}
      </section>

      {/* The one place free windows are listed: per unit, each with the
          price to ask per night (the alerts page only counts them). */}
      <section>
        <h2>{t(locale, "calendar_gaps")}</h2>
        <p className="section-hint">{t(locale, "calendar_gaps_hint")}</p>
        {rows.every((r) => (gapsOf.get(r.unit.id) ?? []).length === 0) ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "calendar_no_gaps")}</p>
        ) : (
          <div className="gap-grid">
            {rows.map(({ unit }, r) => {
              const gaps = gapsOf.get(unit.id) ?? [];
              if (gaps.length === 0) return null;
              return (
                <div key={unit.id} className="card gap-unit">
                  <div className="gap-unit__head">
                    <AlertTypeIcon type="vacancy_gap" />
                    <Link
                      href={`/calendar?month=${monthParam(year, month)}&unit=${unit.id}`}
                      className="gap-unit__name"
                    >
                      {displayName(unit)}
                    </Link>
                  </div>
                  <ul className="gap-unit__list">
                    {gaps.map((gap, i) => (
                      <li key={i}>
                        <span>
                          {fmtDay.format(gap.start)} – {fmtDay.format(gap.end)}
                          <span className="gap-unit__nights">
                            {" "}· {gap.nights} {t(locale, "nights_short")}
                          </span>
                        </span>
                        {priced[r][i] && (
                          <b>
                            {t(locale, "calendar_gap_price").replace(
                              "{price}",
                              formatMoney(priced[r][i]!.perNight, unit.currency),
                            )}
                          </b>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Link href={`/pricing?unit=${unit.id}`} className="link icon-text gap-unit__more">
                    {t(locale, "calendar_gap_prices")} <IconArrowRight size={13} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* One unit picked: its stays this month, with the price (or "no
          price" for iCal imports) and a way to add it. */}
      {unitQuery && rows[0] && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 style={{ marginBottom: 0 }}>{t(locale, "nav_bookings")}</h2>
            <Link href={`/bookings/new?unit=${unitQuery}`} className="btn-chip">
              {t(locale, "bookings_add")}
            </Link>
          </div>
          {rows[0].unit.bookings.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "bookings_empty")}</p>
          ) : (
            <div className="card card--stack" style={{ marginTop: 12 }}>
              <table>
                <tbody>
                  {[...rows[0].unit.bookings]
                    .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime())
                    .map((booking) => (
                      <tr key={booking.id}>
                        <td>
                          {fmtDay.format(booking.checkIn)} – {fmtDay.format(booking.checkOut)}
                          <div className="cell-sub">
                            {SOURCE_NAME[booking.source] ??
                              t(locale, booking.source === "direct" ? "source_direct" : "source_manual")}
                            {booking.guestName ? ` · ${booking.guestName}` : ""}
                          </div>
                        </td>
                        <td className="num" data-label={t(locale, "booking_price")}>
                          {booking.amount != null ? (
                            formatMoney(booking.amount, booking.currency)
                          ) : (
                            <span className="price-missing">{t(locale, "booking_no_price")}</span>
                          )}
                        </td>
                        <td className="num">
                          <Link href={`/bookings/${booking.id}/edit?back=calendar`} className="link">
                            {booking.amount == null ? t(locale, "booking_add_price") : t(locale, "edit")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      </>
      )}
    </main>
  );
}
