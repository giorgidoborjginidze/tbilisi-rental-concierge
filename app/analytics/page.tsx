import Link from "next/link";
import { monthStartTbilisi, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type Locale } from "@/lib/i18n/strings";
import {
  aggregateMetrics,
  monthWindows,
  type WindowMetrics,
} from "@/lib/analytics/metrics";
import { loadRentalPlaces, placeHref } from "@/lib/property/places";
import { placeMetrics } from "@/lib/property/stays";
import RentalsSubnav from "../rentals-subnav";
import RevenuePartial, { monthKeyOf } from "../revenue-partial";
import { cityLabel, districtLabel } from "@/lib/places";
import { titled } from "@/lib/i18n/metadata";
import { currencySign, formatMoney, formatNumber } from "@/lib/format";
import Kpi from "../kpi";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("analytics_title");

const DAY_MS = 86_400_000;

const pct = (rate: number) => `${Math.round(rate * 100)}%`;
// Table cells carry the number alone (the column names the currency);
// KPI tiles carry the sign: "192 ₾".
const money = (value: number | null, currency: string) =>
  currency ? formatMoney(value, currency) : value == null ? "—" : formatNumber(value);

/**
 * A money cell that says "partial" when some of its nights have no price
 * (revenue and RevPAR are both understated then). With `month`, the note
 * links to that month's stays without a price.
 */
function PartialMoney({
  locale,
  value,
  metrics,
  month,
}: {
  locale: Locale;
  value: number | null;
  metrics: WindowMetrics;
  month?: string;
}) {
  const partial = metrics.unpricedNights > 0;
  const note = t(locale, "revenue_partial").replace("{n}", String(metrics.unpricedNights));
  return (
    <>
      {money(value, "")}
      {partial && (
        <div className="cell-sub price-missing" title={note}>
          {month ? (
            <Link href={`/bookings?show=unpriced&month=${month}`} className="link">
              {t(locale, "revenue_partial_short")}
            </Link>
          ) : (
            t(locale, "revenue_partial_short")
          )}
        </div>
      )}
    </>
  );
}

// Detailed rental analytics: monthly and per-unit breakdowns. The main
// dashboard shows only the profile-level summary; the deep tables live here.
export default async function AnalyticsPage() {
  const operator = await requireOperator();
  const locale = await getLocale();
  // Tbilisi's today and month.
  const today = startOfTodayTbilisi();

  // Analysis range: 5 months back through 3 months ahead.
  const rangeStart = monthStartTbilisi(-5);
  const rangeEnd = monthStartTbilisi(4);

  // Every place let by the night — units with their linked asset's
  // contracts and daily answers, and day-let flats that live only under
  // Assets — one source per night (lib/property/stays.ts). Nights let on a
  // long lease or a long contract are not for sale: out of the available
  // nights.
  const units = await loadRentalPlaces(operator.id, { start: rangeStart, end: rangeEnd });

  const currency = units[0]?.currency ?? "GEL";

  const thisMonth = {
    start: monthStartTbilisi(0),
    end: monthStartTbilisi(1),
  };
  const next30 = { start: today, end: new Date(today.getTime() + 30 * DAY_MS) };

  const perUnitThisMonth = units.map((unit) => ({
    unit,
    metrics: placeMetrics(unit.sources, thisMonth),
  }));
  const portfolioThisMonth = aggregateMetrics(
    perUnitThisMonth.map((row) => row.metrics),
  );
  const portfolioNext30 = aggregateMetrics(
    units.map((unit) => placeMetrics(unit.sources, next30)),
  );

  const months = monthWindows(rangeStart, new Date(rangeEnd.getTime() - DAY_MS));
  const monthly: { key: string; start: Date; metrics: WindowMetrics }[] =
    months.map((window) => ({
      key: window.key,
      start: window.start,
      metrics: aggregateMetrics(
        units.map((unit) => placeMetrics(unit.sources, window)),
      ),
    }));

  // "სექ. 2026" — a two-digit year read like a day ("სექ. 26").
  const fmtMonth = tbilisiFormat(locale, { month: "short", year: "numeric" });
  const displayName = (unit: { name: string; nameKa: string | null }) =>
    locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;

  return (
    <main>
      <RentalsSubnav active="analytics" />
      <h1>{t(locale, "analytics_title")}</h1>
      <p className="mb-5" style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 640 }}>
        {t(locale, "analytics_intro")}
      </p>

      {units.length === 0 && (
        <div className="alert-card" style={{ alignItems: "center" }}>
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "units_empty")}
          </div>
          <Link href="/units/new" className="btn-primary">
            {t(locale, "units_add")}
          </Link>
        </div>
      )}

      {units.length > 0 && (<>
      <section>
        <h2>{t(locale, "this_month")}</h2>
        <div className="kpi-grid kpi-grid--3d kpi-grid--5">
          <Kpi
            label={t(locale, "kpi_occupancy")}
            value={pct(portfolioThisMonth.occupancyRate)}
          />
          <Kpi
            label={t(locale, "kpi_adr")}
            hint={t(locale, "kpi_adr_hint")}
            value={money(portfolioThisMonth.adr, currency)}
          />
          <Kpi
            label={t(locale, "kpi_revpar")}
            hint={t(locale, "kpi_revpar_hint")}
            value={money(portfolioThisMonth.revpar, currency)}
            sub={portfolioThisMonth.unpricedNights > 0 ? t(locale, "revenue_partial_short") : undefined}
            subClassName="price-missing"
          />
          <Kpi
            label={t(locale, "kpi_booking_revenue")}
            value={money(portfolioThisMonth.revenue, currency)}
            sub={portfolioThisMonth.unpricedNights > 0 ? t(locale, "revenue_partial_short") : undefined}
            subClassName="price-missing"
          />
          <Kpi
            label={t(locale, "next_30_occupancy")}
            value={pct(portfolioNext30.occupancyRate)}
          />
        </div>
        <RevenuePartial
          locale={locale}
          nights={portfolioThisMonth.unpricedNights}
          month={monthKeyOf(thisMonth.start)}
        />
      </section>

      <section>
        <h2>{t(locale, "monthly_title")}</h2>
        {/* On a phone each row becomes a small card with its labels, the
            income first (globals.css .table-stack). */}
        <div className="card table-stack">
          <table>
            <thead>
              <tr>
                <th>{t(locale, "month_col")}</th>
                <th className="num">{t(locale, "kpi_occupancy")}</th>
                <th className="num">{t(locale, "nights_sold")}</th>
                <th className="num" title={t(locale, "kpi_adr_hint")}>{t(locale, "kpi_adr_short")}</th>
                <th className="num" title={t(locale, "kpi_revpar_hint")}>{t(locale, "kpi_revpar_short")}</th>
                <th className="num">
                  {t(locale, "kpi_booking_revenue")} ({currencySign(currency)})
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
                    <td className="table-stack__title">{fmtMonth.format(row.start)}</td>
                    <td className="num" data-label={t(locale, "kpi_occupancy")}>{pct(row.metrics.occupancyRate)}</td>
                    <td className="num" data-label={t(locale, "nights_sold")}>{row.metrics.bookedNights}</td>
                    <td className="num" data-label={`${t(locale, "kpi_adr_short")} (${currencySign(currency)})`}>
                      {money(row.metrics.adr, "")}
                    </td>
                    <td className="num" data-label={`${t(locale, "kpi_revpar_short")} (${currencySign(currency)})`}>
                      <PartialMoney locale={locale} value={row.metrics.revpar} metrics={row.metrics} />
                    </td>
                    <td
                      className="num table-stack__key"
                      data-label={`${t(locale, "kpi_booking_revenue")} (${currencySign(currency)})`}
                    >
                      <PartialMoney
                        locale={locale}
                        value={row.metrics.revenue}
                        metrics={row.metrics}
                        month={row.key}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>{t(locale, "per_unit_title")}</h2>
        <div className="card table-stack">
          <table>
            <thead>
              <tr>
                <th>{t(locale, "unit_name")}</th>
                <th>{t(locale, "unit_district")}</th>
                <th className="num">{t(locale, "kpi_occupancy")}</th>
                <th className="num" title={t(locale, "kpi_adr_hint")}>{t(locale, "kpi_adr_short")}</th>
                <th className="num" title={t(locale, "kpi_revpar_hint")}>{t(locale, "kpi_revpar_short")}</th>
                <th className="num">
                  {t(locale, "kpi_booking_revenue")} ({currencySign(currency)})
                </th>
              </tr>
            </thead>
            <tbody>
              {perUnitThisMonth.map(({ unit, metrics }) => (
                <tr key={unit.key}>
                  <td className="table-stack__title">
                    <Link href={placeHref(unit)} className="link">
                      {displayName(unit)}
                    </Link>
                    <div className="cell-sub">{cityLabel(locale, unit.city)}</div>
                  </td>
                  <td data-label={t(locale, "unit_district")}>{districtLabel(locale, unit.district)}</td>
                  <td className="num" data-label={t(locale, "kpi_occupancy")}>
                    {metrics.availableNights === 0 && metrics.leasedNights > 0 ? (
                      <span className="badge badge--rented" title={t(locale, "analytics_leased_hint")}>
                        {t(locale, "analytics_leased")}
                      </span>
                    ) : (
                      pct(metrics.occupancyRate)
                    )}
                  </td>
                  <td className="num" data-label={`${t(locale, "kpi_adr_short")} (${currencySign(currency)})`}>
                    {money(metrics.adr, "")}
                  </td>
                  <td className="num" data-label={`${t(locale, "kpi_revpar_short")} (${currencySign(currency)})`}>
                    <PartialMoney locale={locale} value={metrics.revpar} metrics={metrics} />
                  </td>
                  <td
                    className="num table-stack__key"
                    data-label={`${t(locale, "kpi_booking_revenue")} (${currencySign(currency)})`}
                  >
                    <PartialMoney
                      locale={locale}
                      value={metrics.revenue}
                      metrics={metrics}
                      month={monthKeyOf(thisMonth.start)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </>)}
    </main>
  );
}
