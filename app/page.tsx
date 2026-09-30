import { cache, type ReactNode } from "react";
import type { Metadata } from "next";
import { pageTitle } from "@/lib/i18n/metadata";
import Link from "next/link";
import { deskHref } from "@/lib/rentals/desk";
import { prisma } from "@/lib/db";
import { getSessionOperator, type SessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import type { Locale } from "@/lib/i18n/strings";
import { aggregateMetrics } from "@/lib/analytics/metrics";
import { loadRentalPlaces } from "@/lib/property/places";
import { placeMetrics, stayOn } from "@/lib/property/stays";
import { monthlyIncome } from "@/lib/analytics/monthly-income";
import { incomeParts } from "@/lib/analytics/income-display";
import { cookies } from "next/headers";
import SplashIntro from "./splash-intro";
import { showSplash, SPLASH_COOKIE } from "@/lib/ui/splash";
import HeroLogo from "./hero-logo";
import MotionPause from "./motion-pause";
import PortfolioDeck from "./portfolio-deck";
import CountUp from "./count-up";
import TourPrompt from "./tour-prompt";
import RevenuePartial, { monthKeyOf } from "./revenue-partial";
import {
  AssetDeck,
  CompositionRing,
  IncomeBars,
  MarketTips,
  PortfolioRing,
  WealthHero,
  ringPartsFromAssets,
} from "./dash-extras";
import { TodayMoves, TodaySection } from "./dash-today";
import {
  activeContract as runningContract,
  assetStatusNow,
  isActiveContract,
} from "@/lib/rentals/phase";
import { rentLabel } from "@/lib/rentals/display";
import {
  monthStartTbilisi,
  startOfTodayTbilisi,
  startOfTomorrowTbilisi,
  tbilisiFormat,
} from "@/lib/time";
import { LIVE_STAY } from "@/lib/bookings/live";
import { districtLabel } from "@/lib/places";
import { formatMoney } from "@/lib/format";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { setupChoices } from "@/lib/onboarding/setup";
import { IconCalendar, IconCar, IconKey, IconTrendUp } from "./icons";

export const dynamic = "force-dynamic";

// Signed out: the site's own title (layout). Signed in: the dashboard's.
export async function generateMetadata(): Promise<Metadata> {
  if (!(await getSessionOperator())) return {};
  return { title: pageTitle(t(await getLocale(), "nav_dashboard")) };
}

const DAY_MS = 86_400_000;

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

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
      color: "linear-gradient(140deg, #a8daf5, #5ab0e0)",
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
      color: "linear-gradient(140deg, #bdf0e0, #6ed3b8)",
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
      color: "linear-gradient(140deg, #f9e5b8, #ecc06a)",
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
      color: "linear-gradient(140deg, #d3cbf8, #988ae6)",
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
      <MotionPause />
      <section className="land-hero" data-motion>
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
          className="alert-card alert-card--info"
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
        <div className="pv" aria-hidden data-motion>
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
          {/* Drawn by a sliding reveal (two opposite transforms the
              compositor runs), not by animating the stroke — which
              repainted the path on the main thread every frame. */}
          <div className="pv__spark">
            <div className="pv__spark-in">
              <svg viewBox="0 0 220 48">
                <path d="M2 40 C30 38 40 24 62 26 S 100 10 124 16 S 170 30 218 6" fill="none" />
              </svg>
            </div>
          </div>
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

// Every dashboard reads in one order: the hero number → "Today" → the
// composition ring → the property deck → the income bars → the profile's
// own working section → Market Advice, last, with nothing below it. No
// KPI grid repeats the hero's figures.

/**
 * An account with nothing in it yet: not a feature tour over empty screens
 * but one question — "what do you have?" — whose answers open the add form
 * ready for it (a flat let long-term asks for the tenant and the rent in
 * the same save; a day-let flat opens on the day rate; a car on the plate
 * and the driver). The workspace's own kind comes first. No zeros.
 */
function SetupCard({ locale, profile }: { locale: Locale; profile: string }) {
  const choices = setupChoices(profile);
  const icon = (key: string) =>
    key === "long_term" ? (
      <IconKey size={22} />
    ) : key === "daily" ? (
      <IconCalendar size={22} />
    ) : key === "cars" ? (
      <IconCar size={22} />
    ) : (
      <IconTrendUp size={22} />
    );
  return (
    <section className="card setup-card" aria-labelledby="setup-title">
      <h2 id="setup-title">{t(locale, "setup_title")}</h2>
      <p className="setup-card__lead">{t(locale, "setup_lead")}</p>
      <div className="setup-choices">
        {choices.map((choice) => (
          <Link key={choice.key} href={choice.href} className="setup-choice">
            <span className="setup-choice__ico" aria-hidden>
              {icon(choice.key)}
            </span>
            <span className="setup-choice__title">{t(locale, `setup_${choice.key}` as StringKey)}</span>
            <span className="setup-choice__sub">{t(locale, `setup_${choice.key}_sub` as StringKey)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Nothing in the workspace yet — no asset, no unit. Read once per request
 * (the dashboard and the tour prompt both ask).
 */
const isEmptyWorkspace = cache(async (operatorId: string) => {
  const [assets, units] = await Promise.all([
    prisma.asset.findFirst({ where: { operatorId }, select: { id: true } }),
    prisma.unit.findFirst({ where: { operatorId }, select: { id: true } }),
  ]);
  return assets == null && units == null;
});

/**
 * A dashboard's own queries, started together with the emptiness check
 * (one round trip, not two); null for an empty workspace, which shows the
 * setup card instead.
 */
async function unlessEmpty<T>(operatorId: string, load: () => Promise<T>): Promise<T | null> {
  const data = load();
  // Awaited below; an empty workspace drops it without an unhandled rejection.
  data.catch(() => undefined);
  if (await isEmptyWorkspace(operatorId)) return null;
  return data;
}

const sourceLabel = (locale: Locale, source: string) =>
  source === "airbnb"
    ? "Airbnb"
    : source === "booking"
      ? "Booking.com"
      : source === "direct"
        ? t(locale, "source_direct")
        : t(locale, "source_manual");

// ——— Hotel / aparthotel: tonight's house, today's arrivals and departures. ———
async function HotelDashboard({
  locale,
  operator,
}: {
  locale: Locale;
  operator: SessionOperator;
}) {
  // Tbilisi's today: arrivals after midnight belong to the new day.
  const today = startOfTodayTbilisi();
  const tomorrow = startOfTomorrowTbilisi();
  const monthStart = monthStartTbilisi(0);
  const monthEnd = monthStartTbilisi(1);

  const loaded = await unlessEmpty(operator.id, () => Promise.all([
    prisma.unit.count({ where: { operatorId: operator.id } }),
    // Stays that arrive or leave today.
    prisma.booking.findMany({
      where: {
        ...LIVE_STAY,
        unit: { operatorId: operator.id },
        OR: [
          { checkIn: { gte: today, lt: tomorrow } },
          { checkOut: { gte: today, lt: tomorrow } },
        ],
      },
      include: { unit: { select: { id: true, name: true, nameKa: true } } },
      orderBy: { checkIn: "asc" },
    }),
    monthlyIncome(operator.id, monthStart),
    // The same places and nights as /analytics (lib/property/places.ts).
    loadRentalPlaces(operator.id, {
      start: new Date(Math.min(monthStart.getTime(), today.getTime())),
      end: new Date(Math.max(monthEnd.getTime(), today.getTime() + DAY_MS)),
    }),
  ]));
  if (!loaded) {
    return (
      <main>
        <DashboardHeader locale={locale} operator={operator} sub={t(locale, "profile_hotel")} />
        <SetupCard locale={locale} profile="hotel" />
        <MarketTips locale={locale} operatorId={operator.id} empty />
      </main>
    );
  }
  const [unitCount, moves, income, places] = loaded;

  const monthWindow = { start: monthStart, end: monthEnd };
  // Nightly metrics, one source per night; nights let on a long lease or
  // a long contract are not for sale.
  const portfolio = aggregateMetrics(places.map((place) => placeMetrics(place.sources, monthWindow)));
  const currency = moves[0]?.currency ?? "GEL";
  // Places a stay, a contract or today's answer holds tonight.
  const occupiedNow = places.filter((place) => stayOn(place.sources, today) != null).length;
  const partial = portfolio.unpricedNights > 0 ? ` (${t(locale, "revenue_partial_short")})` : "";

  const displayName = (unit: { name: string; nameKa: string | null }) =>
    locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;
  const inToday = (d: Date) => d >= today && d < tomorrow;
  const moveRow = (booking: (typeof moves)[number]) => ({
    key: booking.id,
    href: `/calendar?unit=${booking.unit.id}&month=${monthKeyOf(today)}`,
    name: displayName(booking.unit),
    sub: [
      booking.guestName,
      sourceLabel(locale, booking.source),
      `${booking.nights} ${t(locale, "nights_short")}`,
    ]
      .filter(Boolean)
      .join(" · "),
    aside:
      booking.amount != null ? (
        <Link href={`/bookings/${booking.id}/edit`} className="today-moves__amount">
          {formatMoney(booking.amount, booking.currency)}
        </Link>
      ) : (
        // Imported stays arrive without a price.
        <Link href={`/bookings/${booking.id}/edit`} className="today-moves__amount price-missing">
          {t(locale, "booking_no_price")}
        </Link>
      ),
  });

  return (
    <main>
      <DashboardHeader
        locale={locale}
        operator={operator}
        sub={`${t(locale, "profile_hotel")} · ${unitCount} ${t(locale, "nav_units").toLowerCase()}`}
      />

      {/* The same "all income" as the income bars and /assets; the
          booking-side figures (the analytics ones) ride as chips. */}
      <WealthHero
        label={t(locale, "income_all_month")}
        total={income.total}
        sub={incomeParts(locale, income, (v) => formatMoney(v))}
        chips={
          places.length > 0
            ? [
                `${t(locale, "dash_occupied_now")}: ${occupiedNow} / ${places.length}`,
                `${t(locale, "kpi_occupancy")}: ${pct(portfolio.occupancyRate)}`,
                `${t(locale, "kpi_adr_short")}: ${formatMoney(portfolio.adr, currency)}`,
                `${t(locale, "kpi_revpar_chip")}: ${formatMoney(portfolio.revpar, currency)}${partial}`,
                `${t(locale, "kpi_booking_revenue")}: ${formatMoney(portfolio.revenue, currency)}${partial}`,
              ]
            : []
        }
        link={places.length > 0 ? { href: "/analytics", label: t(locale, "nav_analytics") } : undefined}
      />
      <RevenuePartial locale={locale} nights={portfolio.unpricedNights} month={monthKeyOf(monthStart)} />

      <TodaySection
        locale={locale}
        operatorId={operator.id}
        moves={
          unitCount > 0 ? (
            <TodayMoves
              columns={[
                {
                  title: t(locale, "today_arrivals"),
                  empty: t(locale, "today_none"),
                  rows: moves.filter((b) => inToday(b.checkIn)).map(moveRow),
                },
                {
                  title: t(locale, "today_departures"),
                  empty: t(locale, "today_none"),
                  rows: moves.filter((b) => inToday(b.checkOut)).map(moveRow),
                },
              ]}
            />
          ) : null
        }
      />

      <PortfolioRing locale={locale} operatorId={operator.id} />
      <AssetDeck locale={locale} operatorId={operator.id} />
      <IncomeBars locale={locale} operatorId={operator.id} />

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
  const today = startOfTodayTbilisi();
  const in30 = new Date(today.getTime() + 30 * DAY_MS);

  const loaded = await unlessEmpty(operator.id, () => Promise.all([
    prisma.asset.findMany({
      where: { operatorId: operator.id, category: { not: "income_source" } },
      include: {
        contracts: { where: LIVE_CONTRACT, orderBy: { endDate: "desc" } },
        days: { where: { date: today, rented: true }, select: { id: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    monthlyIncome(operator.id),
  ]));
  if (!loaded) {
    return (
      <main>
        <DashboardHeader locale={locale} operator={operator} sub={t(locale, "profile_brokerage")} />
        <SetupCard locale={locale} profile="brokerage" />
        <MarketTips locale={locale} operatorId={operator.id} empty />
      </main>
    );
  }
  const [assets, income] = loaded;

  // The asset follows its contracts: a lease that has ended no longer
  // keeps it counted as rented.
  const effectiveStatus = (asset: (typeof assets)[number]) =>
    runningContract(asset.contracts, today)
      ? "rented"
      : asset.unitId
        ? "rented"
        : assetStatusNow(asset, asset.contracts, today, { rentedToday: asset.days.length > 0 });
  const statusCounts = new Map<string, number>();
  for (const asset of assets) {
    const status = effectiveStatus(asset);
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  const expiring = assets
    .flatMap((asset) =>
      asset.contracts
        .filter((c) => isActiveContract(c, today) && c.endDate <= in30)
        .map((c) => ({ asset, contract: c })),
    )
    .sort((a, b) => a.contract.endDate.getTime() - b.contract.endDate.getTime());

  const fmtDate = tbilisiFormat(locale, { day: "numeric", month: "short" });
  const displayName = (a: { name: string; nameKa: string | null }) =>
    locale === "ka" && a.nameKa ? a.nameKa : a.name;

  return (
    <main>
      <DashboardHeader locale={locale} operator={operator} sub={t(locale, "profile_brokerage")} />

      <WealthHero
        label={t(locale, "income_all_month")}
        total={income.total}
        sub={incomeParts(locale, income, (v) => formatMoney(v))}
        chips={[
          `${t(locale, "dash_managed")}: ${assets.length}`,
          ...(["rented", "listed", "vacant", "personal_use"] as const)
            .filter((status) => (statusCounts.get(status) ?? 0) > 0)
            .map((status) => `${t(locale, `status_${status}` as StringKey)}: ${statusCounts.get(status)}`),
        ]}
        link={{ href: "/assets", label: t(locale, "nav_assets") }}
      />
      <RevenuePartial
        locale={locale}
        nights={income.unpricedNights}
        month={monthKeyOf(monthStartTbilisi(0))}
        adr={false}
      />

      <TodaySection locale={locale} operatorId={operator.id} />

      <PortfolioRing locale={locale} operatorId={operator.id} />
      <AssetDeck locale={locale} operatorId={operator.id} />
      <IncomeBars locale={locale} operatorId={operator.id} />

      {/* The working list: every contract ending within 30 days. */}
      {expiring.length > 0 && (
        <section>
          <h2>{t(locale, "dash_expiring_30")}</h2>
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
                      <Link href={`/assets/${asset.id}/edit#contracts`} className="link">
                        {displayName(asset)}
                      </Link>
                      <div className="cell-sub">
                        {[districtLabel(locale, asset.district), asset.address].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td data-label={t(locale, "contracts_col")}>
                      {rentLabel(locale, contract)} · {contract.tenantName ?? "—"}
                    </td>
                    <td className="num" data-label={t(locale, "contract_until")}>
                      {fmtDate.format(contract.endDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Expiring contracts are listed in full above — not again as tips. */}
      <MarketTips
        locale={locale}
        operatorId={operator.id}
        skip={expiring.length > 0 ? ["contract_expiry"] : []}
      />
    </main>
  );
}

// ——— Car rental: the fleet's money and today's handovers and returns. ———
async function CarRentalDashboard({
  locale,
  operator,
}: {
  locale: Locale;
  operator: SessionOperator;
}) {
  const today = startOfTodayTbilisi();
  const tomorrow = startOfTomorrowTbilisi();

  const loaded = await unlessEmpty(operator.id, () => Promise.all([
    prisma.asset.findMany({
      where: { operatorId: operator.id, category: "vehicle" },
      include: {
        contracts: { where: LIVE_CONTRACT, orderBy: { endDate: "desc" } },
        // A car let day by day is rented today by its daily answer.
        days: { where: { date: today, rented: true }, select: { id: true } },
      },
      orderBy: { name: "asc" },
    }),
    monthlyIncome(operator.id),
  ]));
  if (!loaded) {
    return (
      <main>
        <DashboardHeader locale={locale} operator={operator} sub={t(locale, "profile_car")} />
        <SetupCard locale={locale} profile="car_rental" />
        <MarketTips locale={locale} operatorId={operator.id} empty />
      </main>
    );
  }
  const [vehicles, income] = loaded;

  const rentedNow = vehicles.filter((v) => runningContract(v.contracts, today) || v.days.length > 0).length;
  const inDay = (d: Date) => d >= today && d < tomorrow;
  const displayName = (a: { name: string; nameKa: string | null }) =>
    locale === "ka" && a.nameKa ? a.nameKa : a.name;
  const withContracts = (pick: (c: { startDate: Date; endDate: Date }) => boolean) =>
    vehicles.flatMap((vehicle) =>
      vehicle.contracts
        .filter((c) => pick(c))
        .map((contract) => ({
          key: contract.id,
          // A handover or a return: straight to the car's desk.
          href: deskHref(vehicle.id, "vehicle"),
          name: displayName(vehicle),
          sub: [contract.tenantName, rentLabel(locale, contract)].filter(Boolean).join(" · "),
        })),
    );
  const handovers = withContracts((c) => inDay(c.startDate));
  const returns = withContracts((c) => inDay(c.endDate));

  return (
    <main>
      <DashboardHeader locale={locale} operator={operator} sub={t(locale, "profile_car")} />

      <WealthHero
        label={t(locale, "income_all_month")}
        total={income.total}
        sub={incomeParts(locale, income, (v) => formatMoney(v))}
        chips={
          vehicles.length > 0
            ? [`${t(locale, "dash_rented_now")}: ${rentedNow} / ${vehicles.length}`]
            : []
        }
        link={vehicles.length > 0 ? { href: "/fleet", label: t(locale, "nav_fleet") } : undefined}
      />
      <RevenuePartial
        locale={locale}
        nights={income.unpricedNights}
        month={monthKeyOf(monthStartTbilisi(0))}
        adr={false}
      />

      <TodaySection
        locale={locale}
        operatorId={operator.id}
        fleetLink={vehicles.length > 0}
        moves={
          handovers.length + returns.length > 0 ? (
            <TodayMoves
              columns={[
                { title: t(locale, "today_handovers"), empty: t(locale, "today_none"), rows: handovers },
                { title: t(locale, "today_returns"), empty: t(locale, "today_none"), rows: returns },
              ]}
            />
          ) : null
        }
      />

      <PortfolioRing locale={locale} operatorId={operator.id} />
      <AssetDeck locale={locale} operatorId={operator.id} />
      <IncomeBars locale={locale} operatorId={operator.id} />

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
  const loaded = await unlessEmpty(operator.id, () => Promise.all([
    prisma.asset.findMany({
      where: { operatorId: operator.id },
      select: { category: true, estimatedValue: true },
    }),
    // The one income definition: the same total as the bars and /assets.
    monthlyIncome(operator.id),
  ]));
  if (!loaded) {
    return (
      <main>
        <DashboardHeader locale={locale} operator={operator} sub={t(locale, "account_personal")} />
        <SetupCard locale={locale} profile="personal" />
        <MarketTips locale={locale} operatorId={operator.id} empty />
      </main>
    );
  }
  const [assets, income] = loaded;
  const totalValue = assets.reduce((sum, a) => sum + (a.estimatedValue ?? 0), 0);
  const propertyCount = assets.filter((a) => a.category !== "income_source").length;

  return (
    <main>
      <DashboardHeader locale={locale} operator={operator} sub={t(locale, "account_personal")} />

      <WealthHero
        label={t(locale, "dash_wealth")}
        total={totalValue}
        chips={[
          `${t(locale, "income_all_month")}: ${formatMoney(income.total)}${
            income.unpricedNights > 0 ? ` (${t(locale, "revenue_partial_short")})` : ""
          }`,
          `${t(locale, "nav_assets")}: ${propertyCount}`,
        ]}
      />
      <RevenuePartial
        locale={locale}
        nights={income.unpricedNights}
        month={monthKeyOf(monthStartTbilisi(0))}
        adr={false}
      />

      <TodaySection locale={locale} operatorId={operator.id} />

      <CompositionRing locale={locale} parts={ringPartsFromAssets(locale, assets)} />
      <AssetDeck locale={locale} operatorId={operator.id} />

      {/* The one action the dashboard offers on its own: adding a salary,
          dividend or other income, next to the income it would show in. */}
      <IncomeBars
        locale={locale}
        operatorId={operator.id}
        action={{ href: "/assets/new?category=income_source", label: t(locale, "add_income_source") }}
      />

      <MarketTips locale={locale} operatorId={operator.id} />
    </main>
  );
}

export default async function Home() {
  const [locale, operator, cookieStore] = await Promise.all([getLocale(), getSessionOperator(), cookies()]);
  // The splash: a signed-out visitor's first look this browser session.
  const splash = showSplash(operator != null, cookieStore.get(SPLASH_COOKIE)?.value);
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
      {splash && <SplashIntro tapHint={t(locale, "splash_hint")} />}
      {/* The tour is offered once there is something to show: an empty
          account gets the setup card instead of a walk past zeros. */}
      {operator && !(await isEmptyWorkspace(operator.id)) && (
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
