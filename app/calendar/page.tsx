import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
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
  airbnb: "bg-rose-400 dark:bg-rose-500",
  booking: "bg-sky-400 dark:bg-sky-500",
  direct: "bg-emerald-400 dark:bg-emerald-500",
  manual: "bg-emerald-400 dark:bg-emerald-500",
  lease: "bg-violet-400 dark:bg-violet-500",
};
const OVERLAP_CLASS = "bg-red-600";
const VACANT_CLASS = "bg-neutral-100 dark:bg-neutral-800";

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
  const operator = await prisma.operator.findFirst();
  if (!operator) redirect("/onboarding");

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
              : VACANT_CLASS,
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
    { label: "Airbnb", className: KIND_CLASS.airbnb },
    { label: "Booking.com", className: KIND_CLASS.booking },
    { label: t(locale, "calendar_direct_manual"), className: KIND_CLASS.direct },
    { label: t(locale, "calendar_lease"), className: KIND_CLASS.lease },
    { label: t(locale, "calendar_overlap"), className: OVERLAP_CLASS },
    { label: t(locale, "calendar_vacant"), className: VACANT_CLASS },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t(locale, "nav_calendar")}</h1>
        <div className="flex items-center gap-3">
          <UnitFilter
            units={allUnits.map((u) => ({ id: u.id, label: displayName(u) }))}
            selected={unitQuery ?? ""}
            allLabel={t(locale, "calendar_all_units")}
          />
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?month=${monthParam(prev.year, prev.month)}${unitSuffix}`}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              ←
            </Link>
            <span className="min-w-36 text-center text-sm font-medium">
              {monthLabel}
            </span>
            <Link
              href={`/calendar?month=${monthParam(next.year, next.month)}${unitSuffix}`}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              →
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-xs text-neutral-600 dark:text-neutral-400">
        {legend.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm ${item.className}`} />
            {item.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-900">
              <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left font-medium dark:bg-neutral-900">
                {t(locale, "booking_unit")}
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <th key={i} className="px-0.5 py-2 text-center text-[10px] font-normal text-neutral-500">
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ unit, days }) => (
              <tr key={unit.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="sticky left-0 z-10 max-w-48 truncate bg-white px-3 py-2 dark:bg-neutral-950">
                  <Link href={`/calendar?month=${monthParam(year, month)}&unit=${unit.id}`} className="hover:underline">
                    {displayName(unit)}
                  </Link>
                </td>
                {days.map((day, i) => (
                  <td key={i} className="p-0.5">
                    <div className={`h-6 min-w-3 rounded-sm ${day.className}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-medium">{t(locale, "calendar_gaps")}</h2>
          {rows.every((r) => r.gaps.length === 0) ? (
            <p className="text-sm text-neutral-500">{t(locale, "calendar_no_gaps")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.flatMap(({ unit, gaps }) =>
                gaps.map((gap, i) => (
                  <li
                    key={`${unit.id}-${i}`}
                    className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950"
                  >
                    <span>{displayName(unit)}</span>
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {fmtDay.format(gap.start)} – {fmtDay.format(gap.end)} ·{" "}
                      {gap.nights} {t(locale, "nights_short")}
                    </span>
                  </li>
                )),
              )}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium">{t(locale, "calendar_overlaps")}</h2>
          {rows.every((r) => r.overlaps.length === 0) ? (
            <p className="text-sm text-neutral-500">{t(locale, "calendar_no_overlaps")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.flatMap(({ unit, overlaps }) =>
                overlaps.map((overlap, i) => (
                  <li
                    key={`${unit.id}-${i}`}
                    className="flex items-center justify-between rounded border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950"
                  >
                    <span>
                      {displayName(unit)}{" "}
                      <span className="text-xs text-neutral-500">
                        ({overlap.kinds.join(" + ")})
                      </span>
                    </span>
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {fmtDay.format(overlap.start)} – {fmtDay.format(overlap.end)} ·{" "}
                      {overlap.nights} {t(locale, "nights_short")}
                    </span>
                  </li>
                )),
              )}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
