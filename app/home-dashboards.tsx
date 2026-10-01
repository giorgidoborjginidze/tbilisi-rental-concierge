// The signed-in Home: one dashboard per profile (hotel, brokerage, car
// rental, personal) plus the tour offer. Rendered by app/dashboard/page.tsx,
// which next.config.ts rewrites a signed-in "/" to so that its loading.tsx
// paints the skeleton the moment Home is tapped, and by app/page.tsx as a
// fallback when the rewrite does not apply.

import { cache, Suspense } from "react";
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
import TourPrompt from "./tour-prompt";
import RevenuePartial, { monthKeyOf } from "./revenue-partial";
import {
  AssetDeck,
  IncomeBars,
  MarketTips,
  PortfolioRing,
  WealthHero,
} from "./dash-extras";
import { getNetWorth } from "@/lib/wealth/net-worth";
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

// Signed out: the site's own title (layout). Signed in: the dashboard's.
export async function dashboardMetadata(): Promise<Metadata> {
  if (!(await getSessionOperator())) return {};
  return { title: pageTitle(t(await getLocale(), "nav_dashboard")) };
}

const DAY_MS = 86_400_000;

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

function DashboardHeader({
  locale,
  operator,
  sub,
}: {
  locale: Locale;
  operator: SessionOperator;
  sub: string;
}) {
  // A name, never a whole e-mail address (it wraps over two lines on a
  // phone): without one the greeting stands alone.
  const name = operator.name?.trim();
  // A greeting reads warmer than repeating the brand (already in the logo).
  return (
    <header>
      <h1>{name ? `${t(locale, "greeting")}, ${name}` : t(locale, "greeting")}</h1>
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
        sub={
          // The same places the "occupied now" chip counts (rooms and flats
          // let by the day), in the singular after a number in Georgian.
          places.length > 0
            ? `${t(locale, "profile_hotel")} · ${t(locale, places.length === 1 ? "places_count_one" : "places_count").replace("{n}", String(places.length))}`
            : t(locale, "profile_hotel")
        }
      />

      {/* The same "all income" as the income bars and /assets; the
          booking-side figures (the analytics ones) ride as chips. */}
      <WealthHero
        label={t(locale, "income_all_month")}
        total={income.total}
        approx={
          income.converted
            ? { label: t(locale, "income_converted_short"), reason: t(locale, "income_converted") }
            : undefined
        }
        sub={incomeParts(locale, income, (v) => formatMoney(v))}
        chips={
          places.length > 0
            ? [
                `${t(locale, "dash_occupied_now")}: ${occupiedNow} / ${places.length}`,
                `${t(locale, "kpi_occupancy")}: ${pct(portfolio.occupancyRate)}`,
                `${t(locale, "kpi_adr_short")}: ${formatMoney(portfolio.adr, currency)}`,
                {
                  text: `${t(locale, "kpi_revpar_chip")}: ${formatMoney(portfolio.revpar, currency)}${partial}`,
                  hint: t(locale, "kpi_revpar_hint"),
                },
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
              more={{ href: "/calendar", label: t(locale, "decide_show_all") }}
            />
          ) : null
        }
      />

      <PortfolioRing locale={locale} operatorId={operator.id} folded />
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
        approx={
          income.converted
            ? { label: t(locale, "income_converted_short"), reason: t(locale, "income_converted") }
            : undefined
        }
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
        approx={
          income.converted
            ? { label: t(locale, "income_converted_short"), reason: t(locale, "income_converted") }
            : undefined
        }
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
              more={{ href: "/fleet", label: t(locale, "decide_show_all") }}
            />
          ) : null
        }
      />

      <PortfolioRing locale={locale} operatorId={operator.id} folded />
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
    prisma.asset.count({
      where: { operatorId: operator.id, category: { not: "income_source" } },
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
  const [propertyCount, income] = loaded;
  const chips = [
    `${t(locale, "income_all_month")}: ${formatMoney(income.total)}${
      income.unpricedNights > 0 ? ` (${t(locale, "revenue_partial_short")})` : ""
    }`,
    `${t(locale, "nav_assets")}: ${propertyCount}`,
  ];

  return (
    <main>
      <DashboardHeader locale={locale} operator={operator} sub={t(locale, "account_personal")} />

      {/* What I own today — flats, cars AND coins, shares and metal (the
          same getNetWorth as the ring and /assets). It streams in, so a
          price API taking its time never holds the page. */}
      <Suspense fallback={<WealthHeroWaiting label={t(locale, "dash_wealth")} chips={chips} />}>
        <NetWorthHero locale={locale} operatorId={operator.id} chips={chips} />
      </Suspense>
      <RevenuePartial
        locale={locale}
        nights={income.unpricedNights}
        month={monthKeyOf(monthStartTbilisi(0))}
        adr={false}
      />

      <TodaySection locale={locale} operatorId={operator.id} />

      <PortfolioRing locale={locale} operatorId={operator.id} />
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

async function NetWorthHero({
  locale,
  operatorId,
  chips,
}: {
  locale: Locale;
  operatorId: string;
  chips: string[];
}) {
  const worth = await getNetWorth(operatorId);
  return (
    <WealthHero
      label={t(locale, "dash_wealth")}
      total={worth.total}
      chips={chips}
      approx={
        worth.approximate
          ? {
              label: t(locale, "approx_word"),
              reason: t(
                locale,
                worth.converted && worth.holdingsBasis === "none"
                  ? "net_worth_converted"
                  : worth.holdingsBasis === "live" || worth.holdingsBasis === "none"
                    ? "net_worth_approx_rate"
                    : "net_worth_approx",
              ),
            }
          : undefined
      }
    />
  );
}

/** The hero's place while the net worth is on its way (keeps the tour's target). */
function WealthHeroWaiting({ label, chips }: { label: string; chips: string[] }) {
  return (
    <section className="card wealth-hero" aria-busy="true">
      <div className="wealth-hero__label">{label}</div>
      <div className="wealth-hero__figure">
        <span className="skel__block hero-wait" />
      </div>
      <div className="wealth-hero__chips">
        {chips.map((chip) => (
          <span key={chip} className="chip">{chip}</span>
        ))}
      </div>
    </section>
  );
}

/** The tour is offered once there is something to show: an empty account
 *  gets the setup card instead of a walk past zeros. */
async function HomeTour({ locale, operatorId }: { locale: Locale; operatorId: string }) {
  if (await isEmptyWorkspace(operatorId)) return null;
  return (
    <TourPrompt
      labels={{
        title: t(locale, "tour_prompt_title"),
        body: t(locale, "tour_prompt_body"),
        start: t(locale, "tour_prompt_start"),
        later: t(locale, "tour_prompt_later"),
      }}
    />
  );
}

/** The dashboard for the operator's profile, with the tour offer. */
export default function Dashboard({ locale, operator }: { locale: Locale; operator: SessionOperator }) {
  const dashboard =
    operator.profile === "hotel" ? (
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
      <HomeTour locale={locale} operatorId={operator.id} />
      {dashboard}
    </>
  );
}
