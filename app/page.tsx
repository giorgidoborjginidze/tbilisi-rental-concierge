import type { ReactNode } from "react";
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
import SplashIntro from "./splash-intro";
import HeroLogo from "./hero-logo";
import PortfolioDeck from "./portfolio-deck";
import CountUp from "./count-up";
import TourPrompt from "./tour-prompt";
import {
  CompositionRing,
  DecideToday,
  MarketTips,
  PortfolioRing,
  WealthHero,
  ringPartsFromAssets,
} from "./dash-extras";

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
  const iconProps = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const benefits: { t: StringKey; b: StringKey; icon: ReactNode; color: string }[] = [
    {
      t: "land_b1_t",
      b: "land_b1",
      color: "#2679ad",
      // Everything in one place — a dashboard of tiles.
      icon: (
        <svg {...iconProps} aria-hidden>
          <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
        </svg>
      ),
    },
    {
      t: "land_b2_t",
      b: "land_b2",
      color: "#23c185",
      // Automatic sync — two looping arrows.
      icon: (
        <svg {...iconProps} aria-hidden>
          <path d="M21 3v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 21v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      ),
    },
    {
      t: "land_b3_t",
      b: "land_b3",
      color: "#f97316",
      // Georgia first, then everywhere — a globe.
      icon: (
        <svg {...iconProps} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9S9.5 5.4 12 3Z" />
        </svg>
      ),
    },
    {
      t: "land_b4_t",
      b: "land_b4",
      color: "#3b82f6",
      // Invest with numbers — a rising trend line.
      icon: (
        <svg {...iconProps} aria-hidden>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        </svg>
      ),
    },
  ];
  return (
    <main>
      <section className="land-hero">
        <div className="land-hero__copy">
        <HeroLogo />
        <h1 className="land-hero__title" style={{ fontSize: 32, marginTop: 14 }}>{t(locale, "land_hero")}</h1>
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
        <div
          className="alert-card alert-card--lease"
          style={{ marginTop: 16, alignItems: "center", maxWidth: 560 }}
        >
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "land_demo")}{" "}
            <code style={{ fontWeight: 600 }}>test@activo.world</code> /{" "}
            <code style={{ fontWeight: 600 }}>test1234</code>
          </div>
          <Link href="/login" className="btn-secondary" style={{ whiteSpace: "nowrap" }}>
            {t(locale, "land_demo_cta")}
          </Link>
        </div>
        </div>
        <PortfolioDeck />
      </section>

      {/* Honest numbers only — what the product actually covers. */}
      <section className="land-stats">
        {(
          [
            { to: 4, label: "land_stat_assets" },
            { to: 5, label: "land_stat_platforms" },
            { to: 30, label: "land_stat_days" },
            { to: 15, label: "land_stat_price" },
          ] as const
        ).map((stat) => (
          <div key={stat.label} className="land-stat">
            <div className="land-stat__n">
              <CountUp to={stat.to} />
            </div>
            <div className="land-stat__l">{t(locale, stat.label)}</div>
          </div>
        ))}
      </section>

      {/* Promo video — shown once NEXT_PUBLIC_DEMO_VIDEO_URL is set to the
          MP4 (self-hosted in /public or an external URL). Poster optional. */}
      {process.env.NEXT_PUBLIC_DEMO_VIDEO_URL && (
        <section style={{ maxWidth: 860, marginTop: 34 }}>
          <h2 style={{ marginTop: 0 }}>{t(locale, "land_video_title")}</h2>
          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-card)",
              background: "#000",
            }}
          >
            <video
              controls
              playsInline
              preload="metadata"
              poster={process.env.NEXT_PUBLIC_DEMO_VIDEO_POSTER}
              style={{ width: "100%", display: "block" }}
            >
              <source src={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL} type="video/mp4" />
            </video>
          </div>
        </section>
      )}

      <section className="feature-grid" style={{ marginTop: 28 }}>
        {benefits.map((f) => (
          <div key={f.t} className="feature-card">
            <span className="feature-card__icon" style={{ background: f.color }}>
              {f.icon}
            </span>
            <div className="feature-card__title">{t(locale, f.t)}</div>
            <div className="feature-card__body">{t(locale, f.b)}</div>
          </div>
        ))}
      </section>

      {/* A living miniature of the dashboard — decorative, so the page
          shows the product moving instead of describing it. */}
      <section className="land-preview">
        <div>
          <h2 style={{ marginBottom: 4 }}>{t(locale, "land_preview_title")}</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14, maxWidth: 460 }}>
            {t(locale, "land_preview_sub")}
          </p>
        </div>
        <div className="pv" aria-hidden>
          <div className="pv__bar"><span /><span /><span /></div>
          <div className="pv__kpis">
            {[62, 84, 47].map((h, i) => (
              <div key={i} className="pv__kpi">
                <span
                  className="pv__fill"
                  style={{ "--h": `${h}%`, "--d": `${i * 0.6}s` } as React.CSSProperties}
                />
              </div>
            ))}
          </div>
          <svg className="pv__spark" viewBox="0 0 220 48">
            <path d="M2 40 C30 38 40 24 62 26 S 100 10 124 16 S 170 30 218 6" fill="none" />
          </svg>
          <div className="pv__cal">
            {Array.from({ length: 42 }, (_, i) => (
              <span
                key={i}
                className={`pv__cell pv__cell--${(i * 7) % 4}`}
                style={{ "--d": `${(i % 14) * 0.3 + Math.floor(i / 14) * 0.15}s` } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Three steps from empty to the full picture. */}
      <section>
        <h2>{t(locale, "land_how_title")}</h2>
        <div className="land-steps">
          {(
            [
              ["land_how_1t", "land_how_1"],
              ["land_how_2t", "land_how_2"],
              ["land_how_3t", "land_how_3"],
            ] as const
          ).map(([titleKey, bodyKey], i) => (
            <div key={titleKey} className="land-step">
              <div className="land-step__n">{i + 1}</div>
              <h3>{t(locale, titleKey)}</h3>
              <p>{t(locale, bodyKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — the same answers the support bot gives. */}
      <section className="land-faq">
        <h2>{t(locale, "land_faq_title")}</h2>
        {(
          [
            ["bot_q_what", "bot_a_what"],
            ["bot_q_pricing", "bot_a_pricing"],
            ["bot_q_sync", "bot_a_sync"],
            ["bot_q_payment", "bot_a_payment"],
            ["bot_q_security", "bot_a_security"],
          ] as const
        ).map(([q, a]) => (
          <details key={q} className="faq">
            <summary>
              {t(locale, q)}
              <svg
                className="faq__plus"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </summary>
            <p>{t(locale, a)}</p>
          </details>
        ))}
      </section>

      {/* Closing call to action. */}
      <section className="land-cta">
        <h2>{t(locale, "land_cta_title")}</h2>
        <p>{t(locale, "land_cta_sub")}</p>
        <div className="land-cta__actions">
          <Link href="/register" className="btn-light">
            {t(locale, "register_free")}
          </Link>
          <Link href="/invest" className="btn-ghost">
            {t(locale, "land_try_calc")}
          </Link>
        </div>
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
  const name = operator.name ?? operator.email;
  // A greeting reads warmer than repeating the brand (already in the logo).
  return (
    <header>
      <h1>{t(locale, "greeting")}, {name}</h1>
      <p style={{ color: "var(--color-text-muted)" }}>{sub}</p>
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
          <WealthHero
            label={`${t(locale, "this_month")} · ${t(locale, "kpi_revenue")}`}
            total={portfolio.revenue}
            chips={[
              `${t(locale, "kpi_occupancy")}: ${pct(portfolio.occupancyRate)}`,
              `ADR: ${money(portfolio.adr, currency)}`,
            ]}
          />
          <PortfolioRing locale={locale} operatorId={operator.id} />
          <DecideToday locale={locale} operatorId={operator.id} />
          <section>
            <h2>{t(locale, "this_month")}</h2>
            <div className="kpi-grid kpi-grid--3d kpi-grid--5">
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

      <MarketTips locale={locale} operatorId={operator.id} />
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

      <PortfolioRing locale={locale} operatorId={operator.id} />
      <DecideToday locale={locale} operatorId={operator.id} />

      <section className="kpi-grid kpi-grid--3d kpi-grid--3">
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

      <MarketTips locale={locale} operatorId={operator.id} />
    </main>
  );
}

// ——— Car rental: fleet status + today's handovers and returns. ———
async function CarRentalDashboard({
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

  const [vehicles, alertCount] = await Promise.all([
    prisma.asset.findMany({
      where: { operatorId: operator.id, category: "vehicle" },
      include: { contracts: { orderBy: { endDate: "desc" } } },
      orderBy: { name: "asc" },
    }),
    openAlertCount(operator.id),
  ]);

  const activeContract = (asset: (typeof vehicles)[number]) =>
    asset.contracts.find(
      (c) => c.status !== "ended" && c.startDate <= now && c.endDate >= now,
    );
  const rentedNow = vehicles.filter((v) => activeContract(v)).length;
  const rentIncome = vehicles.reduce(
    (sum, v) => sum + (activeContract(v)?.monthlyRent ?? 0),
    0,
  );

  const inDay = (d: Date) => d >= today && d < tomorrow;
  const withContracts = (pick: (c: { startDate: Date; endDate: Date }) => boolean) =>
    vehicles.flatMap((vehicle) =>
      vehicle.contracts
        .filter((c) => c.status !== "ended" && pick(c))
        .map((contract) => ({ vehicle, contract })),
    );
  const handovers = withContracts((c) => inDay(c.startDate));
  const returns = withContracts((c) => inDay(c.endDate));

  const displayName = (a: { name: string; nameKa: string | null }) =>
    locale === "ka" && a.nameKa ? a.nameKa : a.name;

  const moveList = (
    rows: typeof handovers,
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
              <th>{t(locale, "contract_tenant")}</th>
              <th className="num">{t(locale, "contract_rent")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ vehicle, contract }) => (
              <tr key={contract.id}>
                <td>
                  <Link href={`/assets/${vehicle.id}/edit`} className="link">
                    {displayName(vehicle)}
                  </Link>
                </td>
                <td data-label={t(locale, "contract_tenant")}>
                  {contract.tenantName ?? "—"}
                </td>
                <td className="num" data-label={t(locale, "contract_rent")}>
                  {contract.monthlyRent} {contract.currency}
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
        sub={`🚗 ${t(locale, "profile_car")}`}
      />

      <PortfolioRing locale={locale} operatorId={operator.id} />
      <DecideToday locale={locale} operatorId={operator.id} />

      <section className="kpi-grid kpi-grid--3d">
        <Kpi label={t(locale, "dash_fleet")} value={String(vehicles.length)} />
        <Kpi
          label={t(locale, "dash_rented_now")}
          value={`${rentedNow} / ${vehicles.length}`}
        />
        <Kpi label={t(locale, "dash_rent_month")} value={money(rentIncome)} />
        <Kpi label={t(locale, "dash_open_alerts")} value={String(alertCount)} />
      </section>

      {vehicles.length === 0 && (
        <div className="alert-card" style={{ alignItems: "center" }}>
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "assets_empty")}
          </div>
          <Link href="/assets/new" className="btn-primary">
            {t(locale, "assets_add")}
          </Link>
        </div>
      )}

      {vehicles.length > 0 && (
        <>
          <section>
            <h2>{t(locale, "dash_handovers_today")}</h2>
            {moveList(handovers, "dash_no_handovers")}
          </section>

          <section>
            <h2>{t(locale, "dash_returns_today")}</h2>
            {moveList(returns, "dash_no_returns")}
          </section>
        </>
      )}

      <section>
        <h2>{t(locale, "dash_quick")}</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link href="/assets" className="btn-chip">
            {t(locale, "nav_assets")}
          </Link>
          <Link href="/assets/new" className="btn-chip">
            {t(locale, "assets_add")}
          </Link>
          <Link href="/invest" className="btn-chip">
            {t(locale, "car_title")}
          </Link>
          <Link href="/alerts" className="btn-chip">
            {t(locale, "nav_alerts")}
          </Link>
        </div>
      </section>

      <MarketTips locale={locale} operatorId={operator.id} />
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

      <WealthHero
        label={t(locale, "dash_wealth")}
        total={totalValue}
        chips={[
          `${t(locale, "assets_monthly_income")}: ${money(totalMonthly)}`,
          `${t(locale, "nav_assets")}: ${propertyCount}`,
        ]}
      />

      <CompositionRing locale={locale} parts={ringPartsFromAssets(locale, assets)} />

      <DecideToday locale={locale} operatorId={operator.id} />

      <section className="kpi-grid kpi-grid--3d kpi-grid--3">
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

      <MarketTips locale={locale} operatorId={operator.id} />
    </main>
  );
}

export default async function Home() {
  const locale = await getLocale();
  const operator = await getSessionOperator();
  const content = !operator ? (
    <Landing locale={locale} />
  ) : operator.profile === "hotel" ? (
    <HotelDashboard locale={locale} operator={operator} />
  ) : operator.profile === "brokerage" ? (
    <BrokerageDashboard locale={locale} operator={operator} />
  ) : operator.profile === "car_rental" ? (
    <CarRentalDashboard locale={locale} operator={operator} />
  ) : (
    <PersonalDashboard locale={locale} operator={operator} />
  );
  return (
    <>
      <SplashIntro tapHint={t(locale, "splash_hint")} />
      {operator && (
        <TourPrompt
          labels={{
            title: t(locale, "tour_prompt_title"),
            body: t(locale, "tour_prompt_body"),
            start: t(locale, "tour_prompt_start"),
            later: t(locale, "tour_prompt_later"),
          }}
        />
      )}
      {content}
    </>
  );
}
