import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import {
  aggregateMetrics,
  monthWindows,
  unitWindowMetrics,
  type BookingLike,
  type WindowMetrics,
} from "@/lib/analytics/metrics";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

const pct = (rate: number) => `${Math.round(rate * 100)}%`;
const money = (value: number | null, currency: string) =>
  value == null ? "—" : `${Math.round(value)} ${currency}`;

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default async function Home() {
  const operator = await requireOperator();

  const locale = await getLocale();
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  // Analysis range: 5 months back through 3 months ahead.
  const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const rangeEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 4, 1));

  const units = await prisma.unit.findMany({
    where: { operatorId: operator.id },
    orderBy: [{ city: "asc" }, { district: "asc" }, { name: "asc" }],
    include: {
      bookings: {
        where: {
          status: { not: "cancelled" },
          checkIn: { lt: rangeEnd },
          checkOut: { gt: rangeStart },
        },
      },
    },
  });

  const currency = units[0]?.currency ?? "GEL";
  const bookingsOf = (unit: (typeof units)[number]): BookingLike[] =>
    unit.bookings;

  const thisMonth = {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
  const next30 = { start: today, end: new Date(today.getTime() + 30 * DAY_MS) };

  const perUnitThisMonth = units.map((unit) => ({
    unit,
    metrics: unitWindowMetrics(bookingsOf(unit), thisMonth),
  }));
  const portfolioThisMonth = aggregateMetrics(
    perUnitThisMonth.map((row) => row.metrics),
  );
  const portfolioNext30 = aggregateMetrics(
    units.map((unit) => unitWindowMetrics(bookingsOf(unit), next30)),
  );

  const months = monthWindows(rangeStart, new Date(rangeEnd.getTime() - DAY_MS));
  const monthly: { key: string; start: Date; metrics: WindowMetrics }[] =
    months.map((window) => ({
      key: window.key,
      start: window.start,
      metrics: aggregateMetrics(
        units.map((unit) => unitWindowMetrics(bookingsOf(unit), window)),
      ),
    }));

  const intl = locale === "ka" ? "ka-GE" : "en-GB";
  const fmtMonth = new Intl.DateTimeFormat(intl, { month: "short", year: "2-digit" });
  const displayName = (unit: { name: string; nameKa: string | null }) =>
    locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;

  const headerCell = "px-4 py-3 font-medium";
  const numCell = "px-4 py-3 text-right";

  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">{t(locale, "appName")}</h1>
        <p className="mt-1 text-neutral-500">
          {operator.name} · {units.length} {t(locale, "nav_units").toLowerCase()}
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">{t(locale, "this_month")}</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Kpi
            label={t(locale, "kpi_occupancy")}
            value={pct(portfolioThisMonth.occupancyRate)}
          />
          <Kpi label="ADR" value={money(portfolioThisMonth.adr, currency)} />
          <Kpi label="RevPAR" value={money(portfolioThisMonth.revpar, currency)} />
          <Kpi
            label={t(locale, "kpi_revenue")}
            value={money(portfolioThisMonth.revenue, currency)}
          />
          <Kpi
            label={t(locale, "next_30_occupancy")}
            value={pct(portfolioNext30.occupancyRate)}
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">{t(locale, "monthly_title")}</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
              <tr>
                <th className={headerCell}>{t(locale, "month_col")}</th>
                <th className={`${headerCell} text-right`}>{t(locale, "kpi_occupancy")}</th>
                <th className={`${headerCell} text-right`}>{t(locale, "nights_sold")}</th>
                <th className={`${headerCell} text-right`}>ADR</th>
                <th className={`${headerCell} text-right`}>RevPAR</th>
                <th className={`${headerCell} text-right`}>
                  {t(locale, "kpi_revenue")} ({currency})
                </th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row) => {
                const isCurrent = row.key === months.find((m) => m.start <= today && today < m.end)?.key;
                return (
                  <tr
                    key={row.key}
                    className={`border-t border-neutral-200 dark:border-neutral-800 ${
                      isCurrent ? "bg-neutral-50 font-medium dark:bg-neutral-900" : ""
                    }`}
                  >
                    <td className="px-4 py-3">{fmtMonth.format(row.start)}</td>
                    <td className={numCell}>{pct(row.metrics.occupancyRate)}</td>
                    <td className={numCell}>{row.metrics.bookedNights}</td>
                    <td className={numCell}>{money(row.metrics.adr, "")}</td>
                    <td className={numCell}>{money(row.metrics.revpar, "")}</td>
                    <td className={numCell}>{Math.round(row.metrics.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">{t(locale, "per_unit_title")}</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
              <tr>
                <th className={headerCell}>{t(locale, "unit_name")}</th>
                <th className={headerCell}>{t(locale, "unit_district")}</th>
                <th className={`${headerCell} text-right`}>{t(locale, "kpi_occupancy")}</th>
                <th className={`${headerCell} text-right`}>ADR</th>
                <th className={`${headerCell} text-right`}>RevPAR</th>
                <th className={`${headerCell} text-right`}>
                  {t(locale, "kpi_revenue")} ({currency})
                </th>
              </tr>
            </thead>
            <tbody>
              {perUnitThisMonth.map(({ unit, metrics }) => (
                <tr key={unit.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-3">
                    <Link href={`/calendar?unit=${unit.id}`} className="hover:underline">
                      {displayName(unit)}
                    </Link>
                    <div className="text-xs text-neutral-500">{unit.city}</div>
                  </td>
                  <td className="px-4 py-3">{unit.district}</td>
                  <td className={numCell}>{pct(metrics.occupancyRate)}</td>
                  <td className={numCell}>{money(metrics.adr, "")}</td>
                  <td className={numCell}>{money(metrics.revpar, "")}</td>
                  <td className={numCell}>{Math.round(metrics.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
