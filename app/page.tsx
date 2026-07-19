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
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}</div>
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

  return (
    <main>
      <header>
        <h1>{t(locale, "appName")}</h1>
        <p style={{ color: "var(--color-text-muted)" }}>
          {operator.name} · {units.length} {t(locale, "nav_units").toLowerCase()}
        </p>
      </header>

      <section>
        <h2>{t(locale, "this_month")}</h2>
        <div className="kpi-grid kpi-grid--5">
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

      <section>
        <h2>{t(locale, "monthly_title")}</h2>
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>{t(locale, "month_col")}</th>
                <th className="num">{t(locale, "kpi_occupancy")}</th>
                <th className="num">{t(locale, "nights_sold")}</th>
                <th className="num">ADR</th>
                <th className="num">RevPAR</th>
                <th className="num">
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
                    style={isCurrent ? { background: "var(--color-surface)", fontWeight: 500 } : undefined}
                  >
                    <td>{fmtMonth.format(row.start)}</td>
                    <td className="num">{pct(row.metrics.occupancyRate)}</td>
                    <td className="num">{row.metrics.bookedNights}</td>
                    <td className="num">{money(row.metrics.adr, "")}</td>
                    <td className="num">{money(row.metrics.revpar, "")}</td>
                    <td className="num">{Math.round(row.metrics.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>{t(locale, "per_unit_title")}</h2>
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>{t(locale, "unit_name")}</th>
                <th>{t(locale, "unit_district")}</th>
                <th className="num">{t(locale, "kpi_occupancy")}</th>
                <th className="num">ADR</th>
                <th className="num">RevPAR</th>
                <th className="num">
                  {t(locale, "kpi_revenue")} ({currency})
                </th>
              </tr>
            </thead>
            <tbody>
              {perUnitThisMonth.map(({ unit, metrics }) => (
                <tr key={unit.id}>
                  <td>
                    <Link href={`/calendar?unit=${unit.id}`} className="link">
                      {displayName(unit)}
                    </Link>
                    <div className="cell-sub">{unit.city}</div>
                  </td>
                  <td>{unit.district}</td>
                  <td className="num">{pct(metrics.occupancyRate)}</td>
                  <td className="num">{money(metrics.adr, "")}</td>
                  <td className="num">{money(metrics.revpar, "")}</td>
                  <td className="num">{Math.round(metrics.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
