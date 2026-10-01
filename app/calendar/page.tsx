import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { dayKey, monthKeyTbilisi, startOfTodayTbilisi } from "@/lib/time";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { findGaps, findOverlaps } from "@/lib/calendar/occupancy";
import { loadRentalPlaces, placeHref } from "@/lib/property/places";
import { dayFills, occupiedIntervals, placeStays } from "@/lib/property/stays";
import UnitFilter from "./unit-filter";
import RentalsSubnav from "../rentals-subnav";
import { firstParam, type QueryValue } from "@/lib/params";
import { titled } from "@/lib/i18n/metadata";
import { AlertTypeIcon } from "../alert-icon";
import { formatMoney } from "@/lib/format";
import { IconAlert, IconArrowRight, IconChevronLeft, IconChevronRight } from "../icons";
import { CELL_CLASS, nightCells, nightIndex, OVERLAP_CODE, stripOpen, stripRange } from "@/lib/calendar/cells";
import CalendarStrip, { type StripDay, type StripRow } from "./calendar-strip";
import { benchmarkAdrIn, getMarketDataSource } from "@/lib/market/source";
import { benchmarkMonth, freeWindowRange, placeOccupancy, windowPrice } from "@/lib/pricing/nightly";

export const dynamic = "force-dynamic";

// The Rentals section's landing page: its title is the nav entry's name.
export const generateMetadata = titled("nav_rentals");

const DAY_MS = 86_400_000;

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
  searchParams: Promise<{ month?: QueryValue; unit?: QueryValue; from?: QueryValue }>;
}) {
  const operator = await requireOperator();

  const locale = await getLocale();
  const query = await searchParams;
  const monthQuery = firstParam(query.month);
  const unitQuery = firstParam(query.unit);
  // The night the phone's strip opens on when it was paged here from the
  // neighbouring month (lib/calendar/cells.ts stripHandOff).
  const fromQuery = firstParam(query.from);
  const { year, month } = parseMonth(monthQuery);

  const windowStart = new Date(Date.UTC(year, month - 1, 1));
  const windowEnd = new Date(Date.UTC(year, month, 1));
  const daysInMonth = Math.round(
    (windowEnd.getTime() - windowStart.getTime()) / DAY_MS,
  );

  const today = startOfTodayTbilisi();

  // Free windows worth acting on — from today on, two nights or more
  // (lib/pricing/nightly.ts freeWindowRange) — are looked up over the next
  // 30 nights, so the places are loaded over the month and that stretch.
  const range = freeWindowRange({ start: windowStart, end: windowEnd }, today);
  const aheadEnd = range
    ? new Date(Math.max(range.end.getTime(), today.getTime() + 30 * DAY_MS))
    : today;
  // The phone's two-week strip pages through the month, two weeks before
  // it and four after (so a window near the month's end still pages by
  // whole fortnights) without a round trip.
  const { from: stripFrom, days: stripLength, monthIndex: stripMonthIndex } = stripRange(year, month);
  const stripTo = new Date(stripFrom.getTime() + stripLength * DAY_MS);
  const loadStart = new Date(Math.min(windowStart.getTime(), today.getTime(), stripFrom.getTime()));
  const loadEnd = new Date(Math.max(windowEnd.getTime(), aheadEnd.getTime(), stripTo.getTime()));

  // Every place let by the night, however it was entered: units (with the
  // contracts and daily answers of the asset linked to them) and day-let
  // flats that only exist under Assets (lib/property/places.ts). One
  // source per night (lib/property/stays.ts).
  const places = await loadRentalPlaces(
    operator.id,
    { start: loadStart, end: loadEnd },
    { unitId: unitQuery },
  );

  const allUnits = unitQuery
    ? await prisma.unit.findMany({
        where: { operatorId: operator.id },
        orderBy: [{ city: "asc" }, { name: "asc" }],
        select: { id: true, name: true, nameKa: true },
      })
    : places.flatMap((place) => (place.unit ? [place.unit] : []));

  const inMonth = (stay: { start: Date; end: Date }) =>
    stay.start < windowEnd && stay.end > windowStart;

  const intl = locale === "ka" ? "ka-GE" : "en-GB";
  const fmtDay = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: "UTC" });
  const displayName = (unit: { name: string; nameKa: string | null }) =>
    locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;
  // What a stay is: its channel, a lease or a contract.
  const kindLabel = (kind: string) =>
    SOURCE_NAME[kind] ??
    t(
      locale,
      kind === "direct"
        ? "source_direct"
        : kind === "lease"
          ? "overlap_src_lease"
          : kind === "contract"
            ? "overlap_src_contract"
            : "source_manual",
    );

  const rows = places.map((place) => {
    // Bookings, leases and contracts; two of them on a night is a double
    // booking. A daily answer only fills a night none of them holds.
    const allStays = placeStays(place.sources);
    const allFills = dayFills(place.sources);
    const stays = allStays.filter(inMonth);
    const guests = new Map((place.unit?.bookings ?? []).map((b) => [b.id, b]));

    // What a taken night opens, and what it is called.
    const stayInfo = (index: number): { href: string; label: string } => {
      const stay = index < allStays.length ? allStays[index] : allFills[index - allStays.length];
      if (stay.record === "booking") {
        const booking = guests.get(stay.id);
        return {
          href: `/bookings/${stay.id}/edit?back=calendar`,
          label: [
            kindLabel(stay.kind),
            booking?.guestName,
            booking?.amount != null ? formatMoney(booking.amount, booking.currency) : null,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      }
      const assetPage = place.asset ? `/assets/${place.asset.id}/edit` : placeHref(place, monthParam(year, month));
      if (stay.record === "contract") {
        return { href: place.asset ? `${assetPage}#contracts` : assetPage, label: kindLabel("contract") };
      }
      if (stay.record === "day") return { href: assetPage, label: t(locale, "calendar_day_rented") };
      return { href: placeHref(place, monthParam(year, month)), label: kindLabel("lease") };
    };
    // A free night: the add-a-stay form on that date (a unit), or the
    // flat's own day calendar (a flat that has no unit yet).
    const addHref = place.unit ? `/bookings/new?unit=${place.unit.id}&date=` : null;

    return {
      place,
      stayInfo,
      addHref,
      monthCells: nightCells(allStays, allFills, windowStart, daysInMonth),
      stripCells: nightCells(allStays, allFills, stripFrom, stripLength),
      overlaps: findOverlaps(stays),
      bookings: place.unit?.bookings.filter((b) => b.checkIn < windowEnd && b.checkOut > windowStart) ?? [],
    };
  });

  // ── Each free window with a suggested price: the same rule-based engine
  // as the day-by-day price table (/pricing), without its written
  // explanation: seasonality, the place's own demand over the next 30
  // nights (every stay and daily answer), and the district's average
  // nightly price. Priced from a unit's base rate, so a day-let flat
  // without a unit yet lists no windows. ──
  const aheadOf = (place: (typeof places)[number]) => occupiedIntervals(place.sources);
  const gapsOf = new Map(
    rows.map((row) => [
      row.place.key,
      range && row.place.unit ? findGaps(aheadOf(row.place), range, 2) : [],
    ]),
  );
  const market = getMarketDataSource();
  const benchmarkCache = new Map<string, number | null>();
  const benchmarksFor = async (district: string | null, nights: Date[], currency: string) => {
    const byMonth = new Map<string, number | null>();
    for (const month of new Set(nights.map(benchmarkMonth))) {
      const key = `${district ?? ""}|${month}|${currency}`;
      if (!benchmarkCache.has(key)) {
        benchmarkCache.set(key, await benchmarkAdrIn(market, district, month, currency));
      }
      byMonth.set(month, benchmarkCache.get(key) ?? null);
    }
    return byMonth;
  };
  const priced = await Promise.all(
    rows.map(async (row) => {
      const unit = row.place.unit;
      // No base rate yet (a unit made for an asset with no day price and
      // no district figure): no price to suggest.
      if (!unit || unit.baseNightlyRate <= 0) return [];
      // The same demand input as /pricing (lib/pricing/run.ts).
      const occupancy = placeOccupancy(row.place.sources, today, 30);
      return Promise.all(
        (gapsOf.get(row.place.key) ?? []).map(async (gap) => {
          const nights = Array.from({ length: gap.nights }, (_, i) => new Date(gap.start.getTime() + i * DAY_MS));
          const benchmarks = await benchmarksFor(unit.district, nights, unit.currency);
          return windowPrice(unit, gap, occupancy, benchmarks);
        }),
      );
    }),
  );
  // Each free night's suggested price, for the grid's hover text.
  const nightPrice = new Map<string, number>();
  rows.forEach((row, r) =>
    priced[r].forEach((window) =>
      window?.nights.forEach((night) => nightPrice.set(`${row.place.key}|${night.date.getTime()}`, night.rate)),
    ),
  );

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const unitSuffix = unitQuery ? `&unit=${unitQuery}` : "";

  const monthLabel = new Intl.DateTimeFormat(intl, {
    month: "long",
    year: "numeric",
  }).format(windowStart);

  // The phone's strip: every night of its range, labelled on the server
  // (the same words the rest of the page uses).
  const fmtWeekday = new Intl.DateTimeFormat(intl, { weekday: "short", timeZone: "UTC" });
  const stripDays: StripDay[] = Array.from({ length: stripLength }, (_, i) => {
    const date = new Date(stripFrom.getTime() + i * DAY_MS);
    const weekday = date.getUTCDay();
    return {
      key: dayKey(date),
      wd: fmtWeekday.format(date),
      d: String(date.getUTCDate()),
      title: fmtDay.format(date),
      weekend: weekday === 0 || weekday === 6,
    };
  });
  const stripToday = Math.round((today.getTime() - stripFrom.getTime()) / DAY_MS);
  const stripTodayIndex = stripToday >= 0 && stripToday < stripLength ? stripToday : null;
  const stripRows: StripRow[] = rows.map((row) => {
    const used = new Map<number, number>();
    const stays: StripRow["stays"] = [];
    const cells = row.stripCells.map(([code, stay]): [number, number] => {
      if (stay < 0) return [code, -1];
      if (!used.has(stay)) {
        used.set(stay, stays.length);
        stays.push(row.stayInfo(stay));
      }
      return [code, used.get(stay)!];
    });
    const prices: Record<number, string> = {};
    cells.forEach(([, stay], i) => {
      if (stay >= 0) return;
      const rate = nightPrice.get(`${row.place.key}|${stripFrom.getTime() + i * DAY_MS}`);
      if (rate != null) prices[i] = formatMoney(rate, row.place.currency);
    });
    return {
      key: row.place.key,
      name: displayName(row.place),
      href: placeHref(row.place, monthParam(year, month)),
      addHref: row.addHref,
      cells,
      stays,
      prices,
    };
  });

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
      {allUnits.length === 0 && places.length === 0 ? (
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
            label={t(locale, "booking_unit")}
            units={allUnits.map((u) => ({ id: u.id, label: displayName(u) }))}
            selected={unitQuery ?? ""}
            allLabel={t(locale, "calendar_all_units")}
          />
          {/* On a phone the strip's own arrows page the fortnights and step
              into the neighbouring month: one pair of arrows, not two. */}
          <div className="flex items-center gap-2 cal-month-nav">
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
        {Array.from({ length: daysInMonth }, (_, i) => {
          const isToday = windowStart.getTime() + i * DAY_MS === today.getTime();
          return (
            <span
              key={`h${i}`}
              className={`${dayNumClass(i + 1)}${isToday ? " is-today" : ""}`}
              aria-current={isToday ? "date" : undefined}
            >
              {i + 1}
            </span>
          );
        })}
        {rows.map(({ place, monthCells, stayInfo, addHref }) => (
          <Fragment key={place.key}>
            <span className="cal-name">
              <Link
                href={placeHref(place, monthParam(year, month))}
                title={displayName(place)}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {displayName(place)}
              </Link>
            </span>
            {monthCells.map(([code, stay], i) => {
              // Every night opens something: its booking or contract, or
              // — free — the add-a-stay form on that date.
              const night = new Date(windowStart.getTime() + i * DAY_MS);
              const info = stay >= 0 ? stayInfo(stay) : null;
              const rate = info ? undefined : nightPrice.get(`${place.key}|${night.getTime()}`);
              const title = info
                ? `${fmtDay.format(night)} — ${code === OVERLAP_CODE ? `${t(locale, "calendar_overlap")}: ` : ""}${info.label}`
                : `${fmtDay.format(night)} — ${t(locale, "calendar_cell_free")}${rate != null ? ` · ${formatMoney(rate, place.currency)}` : ""}`;
              return (
                <Link
                  key={i}
                  href={info ? info.href : addHref ? `${addHref}${dayKey(night)}` : placeHref(place, monthParam(year, month))}
                  prefetch={false}
                  className={`cal-cell ${CELL_CLASS[code]}${night.getTime() === today.getTime() ? " is-today" : ""}`}
                  title={title}
                  aria-label={title}
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      {/* Phones: two weeks at a time, full names, today marked, every
          cell a link (the month board above is hidden there). */}
      <CalendarStrip
        // A new month (or a hand-off night) is a new strip: it opens where
        // stripOpen says — the carried-over night, today in today's month,
        // else the month's first night.
        key={`${monthParam(year, month)}|${unitQuery ?? ""}|${fromQuery ?? ""}`}
        days={stripDays}
        rows={stripRows}
        todayIndex={stripTodayIndex}
        openIndex={stripOpen(stripLength, {
          from: nightIndex(stripFrom, fromQuery),
          today: stripTodayIndex,
          currentMonth: monthParam(year, month) === monthKeyTbilisi(),
          fallback: stripMonthIndex,
        })}
        prevMonthHref={`/calendar?month=${monthParam(prev.year, prev.month)}${unitSuffix}`}
        nextMonthHref={`/calendar?month=${monthParam(next.year, next.month)}${unitSuffix}`}
        labels={{
          prev: t(locale, "calendar_prev_weeks"),
          next: t(locale, "calendar_next_weeks"),
          prevMonth: t(locale, "calendar_prev_month"),
          nextMonth: t(locale, "calendar_next_month"),
          today: t(locale, "today_title"),
          free: t(locale, "calendar_cell_free"),
          overlap: t(locale, "calendar_overlap"),
        }}
      />

      {/* A double booking first — it costs money today. */}
      <section style={{ marginTop: 28 }}>
        <h2>{t(locale, "calendar_overlaps")}</h2>
        {rows.every((r) => r.overlaps.length === 0) ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "calendar_no_overlaps")}</p>
        ) : (
          rows.flatMap(({ place, overlaps }) =>
            overlaps.map((overlap, i) => (
              <div key={`${place.key}-${i}`} className="alert-card alert-card--danger">
                <div>
                  <div className="alert-card__title">
                    <AlertTypeIcon type="overlap" />
                    {displayName(place)}{" "}
                    <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-text-muted)" }}>
                      ({overlap.kinds.map(kindLabel).join(" + ")})
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
        {rows.every((r) => (gapsOf.get(r.place.key) ?? []).length === 0) ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "calendar_no_gaps")}</p>
        ) : (
          <div className="gap-grid">
            {rows.map(({ place }, r) => {
              const gaps = gapsOf.get(place.key) ?? [];
              const unit = place.unit;
              if (gaps.length === 0 || !unit) return null;
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
      {unitQuery && rows[0]?.place.unit && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 style={{ marginBottom: 0 }}>{t(locale, "nav_bookings")}</h2>
            <Link href={`/bookings/new?unit=${unitQuery}`} className="btn-chip">
              {t(locale, "bookings_add")}
            </Link>
          </div>
          {rows[0].bookings.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "bookings_empty")}</p>
          ) : (
            <div className="card card--stack" style={{ marginTop: 12 }}>
              <table>
                <tbody>
                  {[...rows[0].bookings]
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
