import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import {
  findGaps,
  findOverlaps,
  type Stay,
} from "@/lib/calendar/occupancy";
import UnitFilter from "./unit-filter";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

const KIND_CLASS: Record<string, string> = {
  airbnb: "cal-cell--airbnb",
  booking: "cal-cell--booking",
  direct: "cal-cell--direct",
  manual: "cal-cell--direct",
  lease: "cal-cell--lease",
};
const OVERLAP_CLASS = "cal-cell--overlap";

function parseMonth(value: string | undefined): { year: number; month: number } {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

const monthParam = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; unit?: string }>;
}) {
  const operator = await requireOperator();

  const locale = await getLocale();
  const { month: monthQuery, unit: unitQuery } = await searchParams;
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
          status: { not: "cancelled" },
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
      gaps: findGaps(stays, { start: windowStart, end: windowEnd }, 2),
      overlaps: findOverlaps(stays),
    };
  });

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

  const legend = [
    { label: "Airbnb", color: "var(--cal-airbnb)" },
    { label: "Booking.com", color: "var(--cal-booking)" },
    { label: t(locale, "calendar_direct_manual"), color: "var(--cal-direct)" },
    { label: t(locale, "calendar_lease"), color: "var(--cal-lease)" },
    { label: t(locale, "calendar_overlap"), color: "var(--cal-overlap)" },
    { label: t(locale, "calendar_vacant"), color: "var(--cal-vacant)", bordered: true },
  ];

  return (
    <main>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>
          {t(locale, "nav_calendar")} — {monthLabel}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <UnitFilter
            units={allUnits.map((u) => ({ id: u.id, label: displayName(u) }))}
            selected={unitQuery ?? ""}
            allLabel={t(locale, "calendar_all_units")}
          />
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?month=${monthParam(prev.year, prev.month)}${unitSuffix}`}
              className="btn-chip"
            >
              ←
            </Link>
            <Link
              href={`/calendar?month=${monthParam(next.year, next.month)}${unitSuffix}`}
              className="btn-chip"
            >
              →
            </Link>
          </div>
        </div>
      </div>

      <div className="legend">
        {legend.map((item) => (
          <span key={item.label}>
            <i
              style={{
                background: item.color,
                border: item.bordered ? "1px solid var(--color-border)" : undefined,
              }}
            />
            {item.label}
          </span>
        ))}
      </div>

      <div className="card" style={{ padding: "12px 16px" }}>
        <div className="cal-row">
          <span className="cal-name" />
          {Array.from({ length: daysInMonth }, (_, i) => (
            <span key={i} className="cal-daynum">
              {i + 1}
            </span>
          ))}
        </div>
        {rows.map(({ unit, days }) => (
          <div key={unit.id} className="cal-row">
            <span className="cal-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <Link
                href={`/calendar?month=${monthParam(year, month)}&unit=${unit.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {displayName(unit)}
              </Link>
            </span>
            {days.map((day, i) => (
              <span key={i} className={`cal-cell ${day.className}`} />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-x-8 md:grid-cols-2">
        <section>
          <h2>{t(locale, "calendar_gaps")}</h2>
          {rows.every((r) => r.gaps.length === 0) ? (
            <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "calendar_no_gaps")}</p>
          ) : (
            rows.flatMap(({ unit, gaps }) =>
              gaps.map((gap, i) => (
                <div key={`${unit.id}-${i}`} className="alert-card alert-card--gap">
                  <div>
                    <div className="alert-card__title">{displayName(unit)}</div>
                    <div className="alert-card__detail">
                      {fmtDay.format(gap.start)} – {fmtDay.format(gap.end)} ·{" "}
                      {gap.nights} {t(locale, "nights_short")}
                    </div>
                  </div>
                </div>
              )),
            )
          )}
        </section>

        <section>
          <h2>{t(locale, "calendar_overlaps")}</h2>
          {rows.every((r) => r.overlaps.length === 0) ? (
            <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "calendar_no_overlaps")}</p>
          ) : (
            rows.flatMap(({ unit, overlaps }) =>
              overlaps.map((overlap, i) => (
                <div key={`${unit.id}-${i}`} className="alert-card alert-card--overlap">
                  <div>
                    <div className="alert-card__title">
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
      </div>
    </main>
  );
}
