import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionOperator, type SessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import type { Locale } from "@/lib/i18n/strings";
import {
  aggregateMetrics,
  proratedRevenue,
  unitWindowMetrics,
} from "@/lib/analytics/metrics";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

const pct = (rate: number) => `${Math.round(rate * 100)}%`;
const money = (value: number | null, currency = "GEL") =>
  value == null ? "—" : `${Math.round(value).toLocaleString("en-US")} ${currency}`;

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}</div>
      {sub && <div className="kpi__sub">{sub}</div>}
    </div>
  );
}

// Public, informational landing for signed-out visitors: what the
// product is, four benefits, the free calculator, one price line.
function Landing({ locale }: { locale: Locale }) {
  const benefits: [StringKey, StringKey][] = [
    ["land_b1_t", "land_b1"],
    ["land_b2_t", "land_b2"],
    ["land_b3_t", "land_b3"],
    ["land_b4_t", "land_b4"],
  ];
  return (
    <main>
      <section style={{ maxWidth: 640, margin: "24px 0 8px" }}>
        <h1 style={{ fontSize: 32 }}>{t(locale, "land_hero")}</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: 15 }}>
          {t(locale, "land_sub")}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/register" className="btn-primary">
            {t(locale, "register_free")}
          </Link>
          <Link href="/invest" className="btn-secondary">
            {t(locale, "land_try_calc")}
          </Link>
        </div>
        <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 12 }}>
          {t(locale, "land_pricing")}
        </p>
      </section>

      <section className="kpi-grid" style={{ marginTop: 28 }}>
        {benefits.map(([titleKey, bodyKey]) => (
          <div key={titleKey} className="kpi">
            <div className="kpi__label">{t(locale, titleKey)}</div>
            <div className="kpi__sub" style={{ fontSize: 13, marginTop: 8 }}>
              {t(locale, bodyKey)}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function DashboardHeader({
  locale,
  operator,
  sub,
}: {
  locale: Locale;
  operator: SessionOperator;
  sub: string;
}) {
  return (
    <header>
      <h1>{t(locale, "appName")}</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        {operator.name ?? operator.email} · {sub}
      </p>
    </header>
  );
}

const openAlertCount = (operatorId: string) =>
  prisma.alert.count({ where: { operatorId, status: "open" } });

const sourceLabel = (locale: Locale, source: string) =>
  source === "airbnb"
    ? "Airbnb"
    : source === "booking"
      ? "Booking.com"
      : source === "direct"
        ? t(locale, "source_direct")
        : t(locale, "source_manual");

// ——— Hotel / aparthotel: today's operations + this month's key numbers. ———
async function HotelDashboard({
  locale,
  operator,
}: {
  locale: Locale;
  operator: SessionOperator;
}) {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  // Fetch a hair wider than the month so a stay ending exactly on the 1st
  // still shows up in today's departures.
  const queryStart = new Date(
    Math.min(monthStart.getTime(), today.getTime()) - DAY_MS,
  );

  const [units, alertCount] = await Promise.all([
    prisma.unit.findMany({
      where: { operatorId: operator.id },
      orderBy: [{ city: "asc" }, { district: "asc" }, { name: "asc" }],
      include: {
        bookings: {
          where: {
            status: { not: "cancelled" },
            checkIn: { lt: monthEnd },
            checkOut: { gt: queryStart },
          },
        },
      },
    }),
    openAlertCount(operator.id),
  ]);

  const currency = units[0]?.currency ?? "GEL";
  const monthWindow = { start: monthStart, end: monthEnd };
  const portfolio = aggregateMetrics(
    units.map((unit) => unitWindowMetrics(unit.bookings, monthWindow)),
  );

  const displayName = (unit: { name: string; nameKa: string | null }) =>
    locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;

  const allBookings = units.flatMap((unit) =>
    unit.bookings.map((booking) => ({ unit, booking })),
  );
  const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();
  const startOfDay = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const arrivals = allBookings.filter(({ booking }) =>
    sameDay(startOfDay(booking.checkIn), today),
  );
  const departures = allBookings.filter(({ booking }) =>
    sameDay(startOfDay(booking.checkOut), today),
  );
  const occupiedNow = new Set(
    allBookings
      .filter(
        ({ booking }) =>
          startOfDay(booking.checkIn) <= today &&
          startOfDay(booking.checkOut) > today,
      )
      .map(({ unit }) => unit.id),
  ).size;

  const stayList = (
    rows: typeof arrivals,
    emptyKey: StringKey,
  ) =>
    rows.length === 0 ? (
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 10 }}>
        {t(locale, emptyKey)}
      </p>
    ) : (
      <div className="card card--stack" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>{t(locale, "unit_name")}</th>
              <th>{t(locale, "dash_guest")}</th>
              <th className="num">{t(locale, "nights_short")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ unit, booking }) => (
              <tr key={booking.id}>
                <td>
                  <Link href={`/calendar?unit=${unit.id}`} className="link">
                    {displayName(unit)}
                  </Link>
                  <div className="cell-sub">{unit.district}</div>
                </td>
                <td data-label={t(locale, "dash_guest")}>
                  {booking.guestName ?? "—"}
                  <div className="cell-sub">{sourceLabel(locale, booking.source)}</div>
                </td>
                <td className="num" data-label={t(locale, "nights_short")}>
                  {booking.nights}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <main>
      <DashboardHeader
        locale={locale}
        operator={operator}
        sub={`🏨 ${t(locale, "profile_hotel")} · ${units.length} ${t(locale, "nav_units").toLowerCase()}`}
      />

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

      {units.length > 0 && (
        <>
          <section>
            <h2>{t(locale, "this_month")}</h2>
            <div className="kpi-grid kpi-grid--5">
              <Kpi label={t(locale, "kpi_occupancy")} value={pct(portfolio.occupancyRate)} />
              <Kpi label="ADR" value={money(portfolio.adr, currency)} />
              <Kpi label="RevPAR" value={money(portfolio.revpar, currency)} />
              <Kpi label={t(locale, "kpi_revenue")} value={money(portfolio.revenue, currency)} />
              <Kpi
                label={t(locale, "dash_occupied_now")}
                value={`${occupiedNow} / ${units.length}`}
              />
            </div>
          </section>

          <section>
            <h2>{t(locale, "dash_arrivals_today")}</h2>
            {stayList(arrivals, "dash_no_arrivals")}
          </section>

          <section>
            <h2>{t(locale, "dash_departures_today")}</h2>
            {stayList(departures, "dash_no_departures")}
          </section>

          <section>
            <h2>{t(locale, "dash_quick")}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Link href="/analytics" className="btn-chip">
                {t(locale, "nav_analytics")}
              </Link>
              <Link href="/calendar" className="btn-chip">
                {t(locale, "nav_calendar")}
              </Link>
              <Link href="/pricing" className="btn-chip">
                {t(locale, "nav_pricing")}
              </Link>
              <Link href="/alerts" className="btn-chip">
                {t(locale, "dash_open_alerts")}: {alertCount}
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

// ——— Brokerage / property management: objects, statuses, contracts. ———
async function BrokerageDashboard({
  locale,
  operator,
}: {
  locale: Locale;
  operator: SessionOperator;
}) {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * DAY_MS);

  const [assets, alertCount] = await Promise.all([
    prisma.asset.findMany({
      where: { operatorId: operator.id, category: { not: "income_source" } },
      include: { contracts: { orderBy: { endDate: "desc" } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    openAlertCount(operator.id),
  ]);

  const activeContract = (asset: (typeof assets)[number]) =>
    asset.contracts.find(
      (c) => c.status !== "ended" && c.startDate <= now && c.endDate >= now,
    );
  const effectiveStatus = (asset: (typeof assets)[number]) =>
    activeContract(asset) ? "rented" : asset.unitId ? "rented" : asset.status;

  const statusCounts = { rented: 0, listed: 0, vacant: 0, personal_use: 0 };
  for (const asset of assets) {
    const status = effectiveStatus(asset);
    statusCounts[status as keyof typeof statusCounts] =
      (statusCounts[status as keyof typeof statusCounts] ?? 0) + 1;
  }

  const rentIncome = assets.reduce(
    (sum, asset) => sum + (activeContract(asset)?.monthlyRent ?? 0),
    0,
  );

  const expiring = assets
    .flatMap((asset) =>
      asset.contracts
        .filter(
          (c) =>
            c.status !== "ended" && c.endDate >= now && c.endDate <= in30,
        )
        .map((c) => ({ asset, contract: c })),
    )
    .sort((a, b) => a.contract.endDate.getTime() - b.contract.endDate.getTime());

  const intl = locale === "ka" ? "ka-GE" : "en-GB";
  const fmtDate = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" });
  const displayName = (a: { name: string; nameKa: string | null }) =>
    locale === "ka" && a.nameKa ? a.nameKa : a.name;

  const statusRows: { key: StringKey; badge: string; count: number }[] = [
    { key: "status_rented", badge: "badge--rented", count: statusCounts.rented },
    { key: "status_listed", badge: "badge--listed", count: statusCounts.listed },
    { key: "status_vacant", badge: "badge--vacant", count: statusCounts.vacant },
    { key: "status_personal_use", badge: "badge--personal", count: statusCounts.personal_use },
  ];

  return (
    <main>
      <DashboardHeader
        locale={locale}
        operator={operator}
        sub={`🏢 ${t(locale, "profile_brokerage")}`}
      />

      <section className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Kpi label={t(locale, "dash_managed")} value={String(assets.length)} />
        <Kpi label={t(locale, "dash_rent_month")} value={money(rentIncome)} />
        <Kpi label={t(locale, "dash_open_alerts")} value={String(alertCount)} />
      </section>

      {assets.length === 0 && (
        <div className="alert-card" style={{ alignItems: "center" }}>
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "assets_empty")}
          </div>
          <Link href="/assets/new" className="btn-primary">
            {t(locale, "assets_add")}
          </Link>
        </div>
      )}

      {assets.length > 0 && (
        <>
          <section>
            <h2>{t(locale, "dash_status_title")}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {statusRows.map((row) => (
                <Link key={row.key} href="/assets" className="btn-chip">
                  <span className={`badge ${row.badge}`} style={{ marginRight: 6 }}>
                    {t(locale, row.key)}
                  </span>
                  {row.count}
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2>{t(locale, "dash_expiring_30")}</h2>
            {expiring.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 10 }}>
                {t(locale, "dash_no_expiring")}
              </p>
            ) : (
              <div className="card card--stack" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t(locale, "unit_name")}</th>
                      <th>{t(locale, "contracts_col")}</th>
                      <th className="num">{t(locale, "contract_until")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiring.map(({ asset, contract }) => (
                      <tr key={contract.id}>
                        <td>
                          <Link href={`/assets/${asset.id}/edit`} className="link">
                            {displayName(asset)}
                          </Link>
                          <div className="cell-sub">
                            {[asset.district, asset.address].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td data-label={t(locale, "contracts_col")}>
                          {contract.monthlyRent} {contract.currency} · {contract.tenantName ?? "—"}
                        </td>
                        <td className="num" data-label={t(locale, "contract_until")}>
                          {fmtDate.format(contract.endDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2>{t(locale, "dash_quick")}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Link href="/assets" className="btn-chip">
                {t(locale, "nav_assets")}
              </Link>
              <Link href="/assets/new" className="btn-chip">
                {t(locale, "assets_add")}
              </Link>
              <Link href="/alerts" className="btn-chip">
                {t(locale, "nav_alerts")}
              </Link>
              <Link href="/invest" className="btn-chip">
                {t(locale, "nav_invest")}
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

// ——— Personal: whole-portfolio overview across assets and income. ———
async function PersonalDashboard({
  locale,
  operator,
}: {
  locale: Locale;
  operator: SessionOperator;
}) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [assets, monthBookings, unitCount, alertCount] = await Promise.all([
    prisma.asset.findMany({
      where: { operatorId: operator.id },
      include: { contracts: { orderBy: { endDate: "desc" } } },
    }),
    prisma.booking.findMany({
      where: {
        status: { not: "cancelled" },
        checkIn: { lt: monthEnd },
        checkOut: { gt: monthStart },
        unit: { operatorId: operator.id },
      },
    }),
    prisma.unit.count({ where: { operatorId: operator.id } }),
    openAlertCount(operator.id),
  ]);

  const activeContract = (asset: (typeof assets)[number]) =>
    asset.contracts.find(
      (c) => c.status !== "ended" && c.startDate <= now && c.endDate >= now,
    );

  const rentIncome = assets.reduce(
    (sum, asset) => sum + (activeContract(asset)?.monthlyRent ?? 0),
    0,
  );
  const recurringIncome = assets.reduce(
    (sum, asset) =>
      asset.category === "income_source" ? sum + (asset.monthlyIncome ?? 0) : sum,
    0,
  );
  const strIncome = monthBookings.reduce(
    (sum, b) => sum + proratedRevenue(b, { start: monthStart, end: monthEnd }),
    0,
  );
  const totalMonthly = rentIncome + recurringIncome + strIncome;
  const totalValue = assets.reduce((sum, a) => sum + (a.estimatedValue ?? 0), 0);
  const propertyCount = assets.filter((a) => a.category !== "income_source").length;

  return (
    <main>
      <DashboardHeader
        locale={locale}
        operator={operator}
        sub={`👤 ${t(locale, "account_personal")}`}
      />

      <section className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Kpi
          label={t(locale, "assets_monthly_income")}
          value={money(totalMonthly)}
          sub={`${t(locale, "income_rent_short")}: ${money(rentIncome + strIncome)} · ${t(locale, "income_other_short")}: ${money(recurringIncome)}`}
        />
        <Kpi label={t(locale, "assets_total_value")} value={money(totalValue)} />
        <Kpi
          label={t(locale, "nav_assets")}
          value={String(propertyCount)}
          sub={`${t(locale, "dash_open_alerts")}: ${alertCount}`}
        />
      </section>

      {assets.length === 0 && (
        <div className="alert-card" style={{ alignItems: "center" }}>
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "assets_empty")}
          </div>
          <Link href="/assets/new" className="btn-primary">
            {t(locale, "assets_add")}
          </Link>
        </div>
      )}

      <section>
        <h2>{t(locale, "dash_quick")}</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link href="/assets" className="btn-chip">
            {t(locale, "nav_assets")}
          </Link>
          <Link href="/assets/new?category=income_source" className="btn-chip">
            {t(locale, "add_income_source")}
          </Link>
          {unitCount > 0 && (
            <Link href="/units" className="btn-chip">
              {t(locale, "nav_rentals")}
            </Link>
          )}
          <Link href="/invest" className="btn-chip">
            {t(locale, "nav_invest")}
          </Link>
          <Link href="/alerts" className="btn-chip">
            {t(locale, "nav_alerts")}
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function Home() {
  const locale = await getLocale();
  const operator = await getSessionOperator();
  if (!operator) return <Landing locale={locale} />;
  if (operator.profile === "hotel")
    return <HotelDashboard locale={locale} operator={operator} />;
  if (operator.profile === "brokerage")
    return <BrokerageDashboard locale={locale} operator={operator} />;
  return <PersonalDashboard locale={locale} operator={operator} />;
}
