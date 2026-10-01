import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { lateContract, periodAmount, statusFor } from "@/lib/rentals/terms";
import { currencySign, formatDueMoney, formatMoney, formatNumber } from "@/lib/format";
import { belowMarketPct } from "@/lib/fx/convert";
import { loadGelRates } from "@/lib/fx/gel-rates";
import { alertSeverity } from "@/lib/ui/tone";
import { alertGlyph } from "./alert-icon";
import { IconArrowRight } from "./icons";
import { adviceTips } from "@/lib/alerts/groups";
import { alertHref } from "@/lib/alerts/links";
import { ADVICE_TYPES, alertRank } from "@/lib/alerts/rank";
import { owingEndingIds } from "@/lib/alerts/owing";
import { deskHref, rentalDesk } from "@/lib/rentals/desk";
import { activeContract as runningContract, assetStatusNow } from "@/lib/rentals/phase";
import { periodWordKey } from "@/lib/rentals/display";
import { templateFamily } from "@/lib/notify/templates";
import { dayKey, monthKeyTbilisi, monthStartTbilisi, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import { estimateMarketRent, getRentBenchmark } from "@/lib/market/rent";
import { monthlyIncomeSeries } from "@/lib/analytics/monthly-income";
import CountUp from "./count-up";
import AssetDeckClient, { type DeckAsset, type DeckSlide } from "./asset-deck-client";
import { districtLabel } from "@/lib/places";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { loadAssetSources, loadRentalPlaces } from "@/lib/property/places";
import { placeMetrics, placeStays } from "@/lib/property/stays";
import { getNetWorth, type NetWorth } from "@/lib/wealth/net-worth";
import { PHYSICAL_GROUPS } from "@/lib/wealth/compose";
import Approx from "./approx";

// The Ice dashboard pieces shared by every profile: the one hero number,
// the composition ring, the property deck, the income bars and the closing
// "market advice" feed. The "Today" block lives in ./dash-today.tsx.

export function WealthHero({
  label,
  total,
  sub,
  chips,
  link,
  approx,
}: {
  label: string;
  total: number;
  /** What the figure is made of (e.g. rent · daily · bookings · other). */
  sub?: string;
  /** The figure rests partly on a last known or purchase price: "≈" + why. */
  approx?: { label: string; reason: string };
  /** Small figures under the hero; a `hint` explains a term (RevPAR). */
  chips: (string | { text: string; hint: string })[];
  /** Where the figures are broken down (analytics, the fleet list). */
  link?: { href: string; label: string };
}) {
  return (
    <section className="card wealth-hero">
      <div className="wealth-hero__label">{label}</div>
      <div className="wealth-hero__figure">
        {approx && <Approx label={approx.label} />}
        <CountUp to={Math.round(total)} /> <small>₾</small>
      </div>
      {sub && <div className="wealth-hero__sub">{sub}</div>}
      {approx && <div className="wealth-hero__sub">{approx.reason}</div>}
      {(chips.length > 0 || link) && (
        <div className="wealth-hero__chips">
          {chips.map((chip) =>
            typeof chip === "string" ? (
              <span key={chip} className="chip">{chip}</span>
            ) : (
              <span key={chip.text} className="chip" title={chip.hint}>
                {chip.text}
                <span className="sr-only"> — {chip.hint}</span>
              </span>
            ),
          )}
          {link && (
            <Link href={link.href} className="chip chip--link icon-text">
              {link.label} <IconArrowRight size={13} />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

export interface RingPart {
  key: string;
  label: string;
  value: number;
  /** Valued partly at a last known or purchase price. */
  approx?: boolean;
  /** Ice gradient stops, light → deep. */
  tint: [string, string];
}

/** The category ice tints, matching the CSS --cat-* tokens. */
export const CATEGORY_TINTS: Record<string, [string, string]> = {
  real_estate: ["#a8daf5", "#5ab0e0"],
  vehicle: ["#d3cbf8", "#988ae6"],
  digital: ["#bdf0e0", "#6ed3b8"],
  income_source: ["#f9e5b8", "#ecc06a"],
  other: ["#cddbe5", "#8aa3b5"],
};

export function CompositionRing({
  locale,
  parts,
  folded = false,
}: {
  locale: Locale;
  parts: RingPart[];
  /** A business dashboard: the ring waits closed under its heading. */
  folded?: boolean;
}) {
  const shown = parts.filter((part) => part.value > 0);
  if (shown.length < 2) return null; // one colour is not a composition

  const total = shown.reduce((sum, part) => sum + part.value, 0);
  const C = 2 * Math.PI * 49.2;
  // Each segment starts where the one before it ends.
  const segments = shown.reduce<(RingPart & { length: number; offset: number })[]>(
    (acc, part) => {
      const prev = acc[acc.length - 1];
      acc.push({
        ...part,
        length: (part.value / total) * C,
        offset: prev ? prev.offset + prev.length : 0,
      });
      return acc;
    },
    [],
  );
  const short = (value: number) =>
    value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(2)}M`
      : value >= 1_000
        ? `${Math.round(value / 1_000)}K`
        : String(Math.round(value));

  const head = (
    <div className="comp-ring__head">
      <h2>{t(locale, "dash_comp_title")}</h2>
      <p>{folded ? `${short(total)} ₾ · ${t(locale, "dash_comp_open")}` : t(locale, "dash_comp_sub")}</p>
    </div>
  );
  const body = (
      <div className="comp-ring__body">
      <svg viewBox="0 0 120 120" role="img" aria-label={t(locale, "dash_comp_title")}>
        <defs>
          {segments.map((seg) => (
            <linearGradient key={seg.key} id={`ring-${seg.key}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={seg.tint[0]} />
              <stop offset="1" stopColor={seg.tint[1]} />
            </linearGradient>
          ))}
        </defs>
        <circle cx="60" cy="60" r="49.2" fill="none" stroke="rgba(120,160,190,.16)" strokeWidth="15" />
        <g transform="rotate(-90 60 60)" strokeWidth="15" fill="none" strokeLinecap="round">
          {segments.map((seg) => (
            <circle
              key={seg.key}
              cx="60" cy="60" r="49.2"
              stroke={`url(#ring-${seg.key})`}
              strokeDasharray={`${Math.max(1, seg.length - 2)} ${C}`}
              strokeDashoffset={-seg.offset}
            />
          ))}
        </g>
        <text x="60" y="57" textAnchor="middle" fontSize="16" fontWeight="800" fill="currentColor">
          {short(total)}
        </text>
        <text x="60" y="73" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-text-muted)">
          ₾
        </text>
      </svg>
      <div className="comp-ring__legend">
        {segments.map((seg) => (
          <div key={seg.key}>
            <i style={{ background: `linear-gradient(140deg, ${seg.tint[0]}, ${seg.tint[1]})` }} />
            {seg.label}
            <b>
              {seg.approx && <Approx label={t(locale, "approx_word")} />}
              {short(seg.value)}
            </b>
          </div>
        ))}
      </div>
      </div>
  );
  // Hotels and fleets read their work first; what the portfolio is made
  // of is one tap away (ia-04), not a screen of its own.
  return folded ? (
    <details className="card comp-ring comp-ring--fold">
      <summary>{head}</summary>
      {body}
    </details>
  ) : (
    <section className="card comp-ring">
      {head}
      {body}
    </section>
  );
}

// ── Market advice: the non-urgent alerts, spoken as advice — a price to
// raise, a free window, a contract ending. Urgent ones are in "Today".
// Nothing renders below this section — it closes the dashboard. ──

// Each tile carries its alert type's line icon on its severity tint —
// the same icon and colour as the card on /alerts (lib/ui/tone.ts).

/** Where each kind of advice actually comes from — stated, not implied. */
const TIP_SOURCE: Record<string, StringKey> = {
  underpriced: "tips_src_bench",
  vacancy_gap: "tips_src_calendar",
  lease_expiry: "tips_src_contract",
  contract_expiry: "tips_src_contract",
  contract_ended: "tips_src_contract",
};

/** Tips shown; the rest are one tap away on /alerts. */
const TIPS_SHOWN = 3;

interface TipPayload {
  assetId?: string;
  assetName?: string;
  unitName?: string;
  start?: string;
  end?: string;
  nights?: number;
  openEnd?: boolean;
  endDate?: string;
  tenantName?: string | null;
  daysLeft?: number;
  month?: string;
  baseNightlyRate?: number;
  suggestedRate?: number;
}

export async function MarketTips({
  locale,
  operatorId,
  empty = false,
  skip = [],
}: {
  locale: Locale;
  operatorId: string;
  /** The account has nothing yet: say where tips will come from. */
  empty?: boolean;
  /** Kinds a section above already lists in full (e.g. expiring contracts). */
  skip?: string[];
}) {
  const types = ADVICE_TYPES.filter((type) => !skip.includes(type));
  const [open, linked] = await Promise.all([
    prisma.alert.findMany({
      where: { operatorId, status: "open", type: { in: types } },
      include: { unit: { select: { id: true, name: true, nameKa: true, currency: true } } },
      take: 300,
    }),
    // A unit and the asset linked to it are one place.
    prisma.asset.findMany({
      where: { operatorId, unitId: { not: null } },
      select: { id: true, unitId: true },
    }),
  ]);
  // A finished contract that still owes rent is not advice: the rent card
  // in "Today" already carries it (lib/alerts/owing.ts). Read together with
  // the names of every place the open advice is about (one round trip).
  const assetIds = [
    ...new Set(open.map((alert) => (alert.payload as TipPayload).assetId).filter(Boolean)),
  ] as string[];
  const [owing, assets] = await Promise.all([
    owingEndingIds(operatorId, open),
    assetIds.length
      ? prisma.asset.findMany({
          where: { id: { in: assetIds }, operatorId },
          select: { id: true, name: true, nameKa: true, category: true, _count: { select: { contracts: { where: LIVE_CONTRACT } } } },
        })
      : Promise.resolve([]),
  ]);
  const todayKey = dayKey(startOfTodayTbilisi());
  const monthNow = todayKey.slice(0, 7);
  // Advice about the past is no advice: a free window already over, an
  // "underpriced" month gone by, a contract already ended (the scan runs
  // once a day — what it wrote yesterday is read against today here).
  const current = open.filter((alert) => {
    if (owing.has(alert.id)) return false;
    const payload = (alert.payload ?? {}) as TipPayload;
    if (alert.type === "vacancy_gap") return !payload.end || payload.end > todayKey || !!payload.openEnd;
    if (alert.type === "underpriced") return !payload.month || payload.month >= monthNow;
    if (alert.type === "contract_expiry" || alert.type === "lease_expiry") {
      return !payload.endDate || payload.endDate >= todayKey;
    }
    return true;
  });
  // One tip per kind per place, the most useful first; each names its
  // place and dates, and leads to the exact spot to act on it.
  const tips = adviceTips(current, types, new Map(linked.map((asset) => [asset.id, asset.unitId!])));

  const assetBy = new Map(assets.map((asset) => [asset.id, asset]));
  const deskOf = (assetId: string) => {
    const asset = assetBy.get(assetId);
    return asset ? rentalDesk(asset.category, asset._count.contracts) : null;
  };
  const named = (row: { name: string; nameKa: string | null }) =>
    locale === "ka" && row.nameKa ? row.nameKa : row.name;

  const fmtDay = tbilisiFormat(locale, { day: "numeric", month: "short" });
  const day = (key: string | undefined) =>
    key && /^\d{4}-\d{2}-\d{2}$/.test(key) ? fmtDay.format(new Date(`${key}T00:00:00Z`)) : "—";
  const monthLabel = (key: string | undefined) =>
    key && /^\d{4}-\d{2}$/.test(key)
      ? tbilisiFormat(locale, { month: "long" }).format(new Date(`${key}-01T00:00:00Z`))
      : "";
  const daysBetween = (from: string, to: string) =>
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  // A window that began before today is shown from today.
  const windowText = (payload: TipPayload) => {
    const start = payload.start && payload.start < todayKey ? todayKey : payload.start;
    const nights =
      payload.start && start !== payload.start && payload.end && !payload.openEnd
        ? daysBetween(todayKey, payload.end)
        : payload.nights;
    return payload.openEnd
      ? `${day(start)} – … · ${nights}+ ${t(locale, "nights_short")}`
      : `${day(start)} – ${day(payload.end)} · ${nights} ${t(locale, "nights_short")}`;
  };

  const detail = (type: string, payload: TipPayload, currency: string): ReactNode => {
    switch (type) {
      case "underpriced":
        // The arrow is a line icon: a text "→" pulls in a whole symbol
        // font file just for itself.
        return (
          <>
            {formatMoney(payload.baseNightlyRate ?? null, currency)}{" "}
            <IconArrowRight size={12} className="inline-arrow" />{" "}
            {formatMoney(payload.suggestedRate ?? null, currency)} · {monthLabel(payload.month)}
          </>
        );
      case "lease_expiry":
      case "contract_expiry": {
        // Counted from today, not from the day the scan wrote it.
        const left = payload.endDate ? daysBetween(todayKey, payload.endDate) : payload.daysLeft;
        return [
          payload.tenantName,
          day(payload.endDate),
          left == null ? null : left <= 0 ? t(locale, "ends_today") : `${left} ${t(locale, "days_left")}`,
        ]
          .filter(Boolean)
          .join(" · ");
      }
      case "contract_ended":
        return [payload.tenantName, `${t(locale, "cstatus_ended")}: ${day(payload.endDate)}`]
          .filter(Boolean)
          .join(" · ");
      default:
        return "";
    }
  };

  const nameOfTip = (first: (typeof open)[number]) => {
    const payload = first.payload as TipPayload;
    const asset = payload.assetId ? assetBy.get(payload.assetId) : undefined;
    return first.unit ? named(first.unit) : asset ? named(asset) : payload.assetName ?? payload.unitName ?? null;
  };

  // Every free window is one tip: how many places and windows, and the
  // nearest — the calendar lists them all (one place to act on them).
  const windows = tips.filter((tip) => tip.type === "vacancy_gap");
  const views: TipView[] = [];
  for (const tip of tips) {
    if (tip.type === "vacancy_gap") continue;
    const first = tip.alerts[0];
    const name = nameOfTip(first);
    views.push({
      key: tip.key,
      type: tip.type,
      rank: alertRank(tip.type),
      title: `${t(locale, `alert_${tip.type}` as StringKey)}${name ? ` — ${name}` : ""}`,
      detail: detail(tip.type, first.payload as TipPayload, first.unit?.currency ?? "GEL"),
      action: t(locale, `action_${tip.type}` as StringKey),
      href: alertHref(first, deskOf),
      source: TIP_SOURCE[tip.type] ?? "tips_src_contract",
    });
  }
  if (windows.length > 0) {
    const first = windows[0].alerts[0];
    const count = windows.reduce((sum, tip) => sum + tip.alerts.length, 0);
    views.push({
      key: "vacancy_gap:all",
      type: "vacancy_gap",
      rank: alertRank("vacancy_gap"),
      title: t(locale, "tips_windows_title"),
      detail: t(locale, "tips_windows_detail")
        .replace("{places}", String(windows.length))
        .replace("{n}", String(count))
        .replace("{name}", nameOfTip(first) ?? "—")
        .replace("{when}", windowText(first.payload as TipPayload)),
      action: t(locale, "action_vacancy_gap"),
      href: "/calendar",
      source: "tips_src_calendar",
    });
  }
  // A long-term rent well under the district's market (live, not waiting
  // for a scan): the same comparison the deck and the asset card make.
  for (const below of await rentBelowMarket(operatorId)) {
    views.push({
      key: `rent_below:${below.id}`,
      type: "underpriced",
      rank: alertRank("underpriced"),
      title: `${t(locale, "tip_rent_below")} — ${named(below)}`,
      detail: t(locale, "tip_rent_below_detail")
        .replace("{rent}", formatMoney(below.rent, below.currency))
        .replace("{market}", formatMoney(below.market, "GEL"))
        .replace("{pct}", String(below.pct)),
      action: t(locale, "tip_rent_below_action"),
      href: `/assets/${below.id}/edit#contracts`,
      source: "tips_src_bench",
    });
  }
  views.sort((a, b) => a.rank - b.rank);
  const shown = views.slice(0, TIPS_SHOWN);

  return (
    <section>
      <h2>{t(locale, "tips_title")}</h2>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: "2px 0 14px" }}>
        {t(locale, "tips_sub")}
      </p>
      {shown.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
          {t(locale, empty ? "tips_empty_start" : "tips_empty")}
        </p>
      ) : (
        <div className="tips-grid">
          {shown.map((tip) => (
            <div key={tip.key} className="card tip-card">
              <span className="tip-card__ico" data-sev={alertSeverity(tip.type)}>
                {alertGlyph(tip.type, 19)}
              </span>
              <div style={{ minWidth: 0 }}>
                <b className="t">{tip.title}</b>
                <span className="tip-card__when">{tip.detail}</span>
                <p>
                  {tip.action}{" "}
                  <Link href={tip.href} className="link icon-text" style={{ gap: 4 }}>
                    {t(locale, "tips_open")} <IconArrowRight size={14} />
                  </Link>
                  <span className="tip-card__src">
                    {t(locale, "tips_source")}: {t(locale, tip.source)}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {views.length > TIPS_SHOWN && (
        <p style={{ margin: "12px 0 0", fontSize: 13 }}>
          <Link href="/alerts" className="link icon-text" style={{ gap: 4 }}>
            {t(locale, "tips_all").replace("{n}", String(views.length))} <IconArrowRight size={14} />
          </Link>
        </p>
      )}
    </section>
  );
}

interface TipView {
  key: string;
  type: string;
  rank: number;
  title: string;
  detail: ReactNode;
  action: string;
  href: string;
  source: StringKey;
}

/** Share of the market rent under which a long-term rent is called low. */
export const BELOW_MARKET_RATIO = 0.9;

/**
 * Flats let long-term for clearly less than the district's market rent
 * (area × the district's GEL/m² estimate), most underpriced first.
 */
async function rentBelowMarket(operatorId: string) {
  const now = new Date();
  const today = startOfTodayTbilisi(now);
  const assets = await prisma.asset.findMany({
    where: {
      operatorId,
      category: "real_estate",
      areaSqm: { not: null },
      district: { not: null },
      contracts: { some: { ...LIVE_CONTRACT, startDate: { lte: today }, endDate: { gt: today } } },
    },
    select: {
      id: true, name: true, nameKa: true, areaSqm: true, district: true,
      contracts: { where: LIVE_CONTRACT, orderBy: { endDate: "desc" } },
    },
  });
  const monthKey = monthKeyTbilisi(now);
  const rates = await loadGelRates();
  const out: { id: string; name: string; nameKa: string | null; rent: number; market: number; pct: number; currency: string }[] = [];
  for (const asset of assets) {
    const contract = runningContract(asset.contracts, today);
    if (!contract) continue;
    const market = estimateMarketRent(asset.areaSqm, await getRentBenchmark(asset.district!, monthKey));
    const below = belowMarketPct(contract.monthlyRent, contract.currency, market, rates, BELOW_MARKET_RATIO);
    if (below == null || !market) continue;
    out.push({
      id: asset.id,
      name: asset.name,
      nameKa: asset.nameKa,
      rent: contract.monthlyRent,
      market,
      pct: below,
      currency: contract.currency,
    });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

/**
 * Ring parts from the one net-worth figure (lib/wealth/net-worth.ts): the
 * physical categories at their estimated value, and one "digital" slice for
 * every coin, share and ounce in GEL — so the ring adds up to the hero.
 */
export function ringPartsFromWorth(locale: Locale, worth: NetWorth): RingPart[] {
  const parts: RingPart[] = PHYSICAL_GROUPS.map((key) => ({
    key,
    label: t(locale, `category_${key}` as StringKey),
    value: worth.physicalByGroup[key],
    tint: CATEGORY_TINTS[key] ?? CATEGORY_TINTS.other,
  }));
  parts.push({
    key: "digital",
    label: t(locale, "category_digital"),
    value: worth.holdings,
    approx: worth.approximate,
    tint: CATEGORY_TINTS.digital,
  });
  return parts.filter((part) => part.value > 0);
}

async function PortfolioRingData({
  locale,
  operatorId,
  folded,
}: {
  locale: Locale;
  operatorId: string;
  folded?: boolean;
}) {
  const worth = await getNetWorth(operatorId);
  return <CompositionRing locale={locale} parts={ringPartsFromWorth(locale, worth)} folded={folded} />;
}

/**
 * The ring, fetching its own data — one line to add on any dashboard. It
 * streams in: a price API taking its time never holds the page above it.
 */
export function PortfolioRing({
  locale,
  operatorId,
  folded,
}: {
  locale: Locale;
  operatorId: string;
  folded?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <PortfolioRingData locale={locale} operatorId={operatorId} folded={folded} />
    </Suspense>
  );
}

const DAY_MS = 86_400_000;

/**
 * The property deck: every physical asset as a card you can swipe between
 * and tap through — value, rent, status, then one piece of advice. It sits
 * on the dashboard so the whole portfolio can be glanced at without ever
 * opening Assets.
 */
export async function AssetDeck({
  locale,
  operatorId,
}: {
  locale: Locale;
  operatorId: string;
}) {
  const now = new Date();
  const today = startOfTodayTbilisi(now);
  const assets = await prisma.asset.findMany({
    where: {
      operatorId,
      category: { in: ["real_estate", "vehicle", "other"] },
    },
    include: {
      contracts: { where: LIVE_CONTRACT, orderBy: { endDate: "desc" } },
      // Today's "rented" answer of a day-let asset counts as rented.
      days: { where: { date: today, rented: true }, select: { id: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    take: 12,
  });

  // District rent benchmarks, so the advice can compare against the market.
  const monthKey = monthKeyTbilisi(now);
  const districts = [...new Set(assets.map((a) => a.district).filter(Boolean))] as string[];
  const benchmarks = new Map(
    await Promise.all(
      districts.map(async (d) => [d, await getRentBenchmark(d, monthKey)] as const),
    ),
  );

  // Tonight's stays of the day-let ones — the same record as the daily
  // check in "Today" (lib/property/stays.ts), so the two never disagree.
  const dayLets = assets.filter((asset) => asset.rentalMode === "daily").map((asset) => asset.id);
  const heldTonight = new Set<string>();
  if (dayLets.length > 0) {
    const sources = await loadAssetSources(operatorId, dayLets, {
      start: today,
      end: new Date(today.getTime() + DAY_MS),
    });
    for (const [assetId, src] of sources) {
      if (placeStays(src).some((stay) => stay.start <= today && stay.end > today)) heldTonight.add(assetId);
    }
    for (const asset of assets) if (asset.days.length > 0) heldTonight.add(asset.id);
  }

  // Rooms (assets linked to a Rentals unit) are judged by their nights, not
  // a market value most owners never enter: this month's occupancy, the
  // same count as /analytics (lib/property/stays.ts placeMetrics).
  const monthWindow = { start: monthStartTbilisi(0, now), end: monthStartTbilisi(1, now) };
  const roomIds = assets.filter((asset) => asset.unitId).map((asset) => asset.id);
  const [roomSources, places, rates] = await Promise.all([
    loadAssetSources(operatorId, roomIds, monthWindow),
    loadRentalPlaces(operatorId, monthWindow),
    loadGelRates(),
  ]);
  // Rentals units with no asset of their own (a hotel's rooms, typically)
  // get a card of their own, built from the unit — the deck is about the
  // places, whichever side they were entered on.
  const looseRooms = places.filter((place) => place.unit && !place.asset).slice(0, 12);
  const roomMonth = new Map(
    [...roomSources].map(([assetId, src]) => [assetId, placeMetrics(src, monthWindow)] as const),
  );

  const fmtMoney = (value: number) => formatNumber(value);
  const fmtDate = tbilisiFormat(locale, {
    day: "numeric", month: "short", year: "numeric",
  });

  const deck: DeckAsset[] = assets.map((asset) => {
    const contract = runningContract(asset.contracts, today);
    const status = contract
      ? "rented"
      : asset.unitId
        ? "str"
        : assetStatusNow(asset, asset.contracts, today, { rentedToday: asset.days.length > 0 });
    const property = templateFamily(asset.category) === "property";
    const displayName =
      locale === "ka" && asset.nameKa ? asset.nameKa : asset.name;
    const marketRent =
      asset.category === "real_estate"
        ? estimateMarketRent(asset.areaSqm, benchmarks.get(asset.district ?? "") ?? null)
        : null;

    const slides: DeckSlide[] = [];
    const room = asset.unitId && !asset.estimatedValue ? roomMonth.get(asset.id) : undefined;

    // 1 · What it is worth — for a room without a value, how full it is.
    if (room) {
      const nights = room.availableNights + room.leasedNights;
      const pct = Math.round(room.occupancyRate * 100);
      slides.push({
        kind: "metric",
        label: t(locale, "deck_occ_month"),
        value: String(pct),
        unit: "%",
        meter: pct,
        note: t(locale, "deck_occ_note")
          .replace("{n}", String(room.occupiedNights))
          .replace("{m}", String(nights)),
      });
    } else slides.push({
      kind: "metric",
      label: t(locale, "asset_value_col"),
      value: asset.estimatedValue ? fmtMoney(asset.estimatedValue) : "—",
      unit: asset.estimatedValue ? currencySign(asset.currency) : undefined,
      note: marketRent
        ? `${t(locale, "market_rent_est")}: ~${fmtMoney(marketRent)} ₾ / ${t(locale, "per_month_word")}`
        : undefined,
    });

    // 2 · What it earns.
    const dayRate = asset.rentalMode === "daily" ? asset.dailyRate : null;
    // The rent per period as agreed — "60 ₾ / day", not a day rate
    // passed off as a month.
    slides.push({
      kind: "metric",
      label: t(locale, "deck_rent"),
      value: contract
        ? formatNumber(periodAmount(contract), "auto")
        : dayRate
          ? fmtMoney(dayRate)
          : "—",
      unit: contract
        ? `${currencySign(contract.currency)} / ${t(locale, periodWordKey(contract.paymentPeriod))}`
        : dayRate
          ? `${currencySign(asset.currency)} / ${t(locale, "per_day_word")}`
          : undefined,
      note: contract
        ? `${contract.tenantName ?? "—"} · ${t(locale, "contract_until")} ${fmtDate.format(contract.endDate)}`
        : dayRate
          ? // A day-let flat: is tonight taken (a booking, an answer, a stay)?
            t(locale, heldTonight.has(asset.id) ? "deck_day_taken" : "deck_day_free")
          : t(locale, "deck_no_rent"),
    });

    // 3 · Where it stands — the payment schedule when tracked, else status.
    // The running contract when it is late — else a finished one that still
    // has rent owed, which stays in sight until it is settled.
    const owing = lateContract(asset.contracts, today, asset);
    const schedule = owing ? statusFor(owing, today, asset) : null;
    if (owing && schedule && ["due", "grace", "repossess"].includes(schedule.state)) {
      slides.push({
        kind: "metric",
        label: t(locale, "pay_days_overdue"),
        value: String(schedule.daysOverdue),
        unit: `/ ${schedule.graceDays}`,
        meter: (schedule.daysOverdue / Math.max(1, schedule.graceDays)) * 100,
        tone: schedule.state === "repossess" ? "bad" : undefined,
        note: `${t(locale, "pay_amount_due")}: ${formatDueMoney(schedule.amountDue, owing.currency)}${
          owing !== contract ? ` · ${t(locale, "cstatus_ended")}` : ""
        }`,
      });
    } else {
      slides.push({
        kind: "metric",
        label: t(locale, "status_label"),
        value: t(locale, `status_${status}` as StringKey),
        note: contract
          ? `${t(locale, "contract_until")} ${fmtDate.format(contract.endDate)}`
          : undefined,
      });
    }

    // 4 · The one thing worth doing about it.
    let advice: DeckSlide;
    if (owing && schedule && owing !== contract) {
      // A finished contract is not chased any more; the money is still owed.
      advice = {
        kind: "advice",
        label: t(locale, "deck_attention"),
        note: t(locale, "deck_adv_ended_owed").replace(
          "{amount}",
          formatDueMoney(schedule.amountDue, owing.currency),
        ),
        tone: "warn",
      };
    } else if (schedule?.state === "repossess") {
      advice = {
        kind: "advice",
        label: t(locale, "deck_attention"),
        note: t(locale, property ? "deck_adv_late_property" : "deck_adv_repossess"),
        tone: "bad",
      };
    } else if (schedule?.state === "due") {
      // Due today is not late: say when it is due and how long the grace is.
      advice = {
        kind: "advice",
        label: t(locale, "deck_attention"),
        note: t(locale, "deck_adv_due_today").replace("{grace}", String(schedule.graceDays)),
        tone: "warn",
      };
    } else if (schedule?.state === "grace") {
      advice = {
        kind: "advice",
        label: t(locale, "deck_attention"),
        note: t(locale, "deck_adv_overdue")
          .replace("{days}", String(schedule.daysOverdue))
          .replace("{grace}", String(schedule.graceDays)),
        tone: "warn",
      };
    } else if (contract && belowMarketPct(contract.monthlyRent, contract.currency, marketRent, rates, BELOW_MARKET_RATIO) != null) {
      const pct = belowMarketPct(contract.monthlyRent, contract.currency, marketRent, rates, BELOW_MARKET_RATIO)!;
      advice = {
        kind: "advice",
        label: t(locale, "deck_advice"),
        note: t(locale, "deck_adv_underpriced").replace("{pct}", String(pct)),
        // Below market is something to look at (amber), not a success.
        tone: "warn",
      };
    } else if (status === "vacant" || status === "listed") {
      const days = Math.max(
        1,
        Math.round((now.getTime() - asset.createdAt.getTime()) / DAY_MS),
      );
      const weekly = marketRent ? Math.round((marketRent / 30) * 7) : null;
      advice = {
        kind: "advice",
        label: t(locale, "deck_advice"),
        note: t(locale, "deck_adv_vacant")
          .replace("{days}", String(Math.min(days, 999)))
          .replace("{loss}", weekly ? `${fmtMoney(weekly)} ₾` : "—"),
        tone: "warn",
      };
    } else if (asset.unitId && asset.rentalMode === "daily") {
      // A room: tonight is the one thing that can still be acted on.
      const taken = heldTonight.has(asset.id);
      advice = {
        kind: "advice",
        label: t(locale, "deck_advice"),
        note: t(locale, taken ? "deck_adv_room_ok" : "deck_adv_room_free"),
        tone: taken ? "good" : "warn",
      };
    } else if (!asset.estimatedValue) {
      advice = {
        kind: "advice",
        label: t(locale, "deck_advice"),
        note: t(locale, "deck_adv_no_value"),
        tone: "warn",
      };
    } else {
      advice = {
        kind: "advice",
        label: t(locale, "deck_advice"),
        note: t(locale, "deck_adv_ok"),
        tone: "good",
      };
    }
    slides.push(advice);

    const desk = asset.category === "vehicle" ? rentalDesk(asset.category, asset.contracts.length, asset.status) : null;
    return {
      id: asset.id,
      name: displayName,
      href: desk ? deskHref(asset.id, desk) : undefined,
      place: [districtLabel(locale, asset.district), asset.address, asset.areaSqm ? `${asset.areaSqm} m²` : null]
        .filter(Boolean)
        .join(" · "),
      category: asset.category,
      badge: asset.category,
      slides,
    };
  });

  for (const place of looseRooms) {
    const unit = place.unit!;
    const month = placeMetrics(place.sources, monthWindow);
    const taken = placeStays(place.sources).some((stay) => stay.start <= today && stay.end > today);
    const pct = Math.round(month.occupancyRate * 100);
    deck.push({
      id: `unit:${unit.id}`,
      name: locale === "ka" && unit.nameKa ? unit.nameKa : unit.name,
      href: `/units/${unit.id}/edit`,
      place: [districtLabel(locale, unit.district), unit.address].filter(Boolean).join(" · "),
      category: "real_estate",
      badge: "real_estate",
      slides: [
        {
          kind: "metric",
          label: t(locale, "deck_occ_month"),
          value: String(pct),
          unit: "%",
          meter: pct,
          note: t(locale, "deck_occ_note")
            .replace("{n}", String(month.occupiedNights))
            .replace("{m}", String(month.availableNights + month.leasedNights)),
        },
        {
          kind: "metric",
          label: t(locale, "deck_rent"),
          value: fmtMoney(unit.baseNightlyRate),
          unit: `${currencySign(unit.currency)} / ${t(locale, "per_day_word")}`,
          note: t(locale, taken ? "deck_day_taken" : "deck_day_free"),
        },
        {
          kind: "advice",
          label: t(locale, "deck_advice"),
          note: t(locale, taken ? "deck_adv_room_ok" : "deck_adv_room_free"),
          tone: taken ? "good" : "warn",
        },
      ],
    });
  }

  if (deck.length === 0) {
    return (
      <section>
        <h2>{t(locale, "deck_title")}</h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
          {t(locale, "deck_empty")}
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="deck-head">
        <div>
          <h2>{t(locale, "deck_title")}</h2>
          <p>{t(locale, "deck_sub")}</p>
        </div>
        <Link href="/assets" className="btn-chip btn-chip--icon-text">
          {t(locale, "deck_all")} <IconArrowRight size={14} />
        </Link>
      </div>
      <AssetDeckClient
        assets={deck}
        labels={{ tap: t(locale, "deck_tap"), restart: t(locale, "deck_restart") }}
      />
    </section>
  );
}

// ── Income, six months back, as tinted ice slabs: "all income" per
// month from lib/analytics/income.ts — the same total as the hero and
// /assets, each night of each place counted once. ──


export async function IncomeBars({
  locale,
  operatorId,
  action,
}: {
  locale: Locale;
  operatorId: string;
  /** One contextual action beside the heading (e.g. add an income source). */
  action?: { href: string; label: string };
}) {
  const series = await monthlyIncomeSeries(operatorId, monthStartTbilisi(-5), 6);
  const months = series.map(({ start, income }) => ({
    start,
    total: income.total,
    // Booked nights without a price: the month earned at least this much.
    unpriced: income.unpricedNights,
  }));
  const anyPartial = months.some((month) => month.unpriced > 0);

  const max = Math.max(...months.map((m) => m.total));
  const fmtMonth = tbilisiFormat(locale, { month: "short" });
  // Six empty months say nothing: the section only shows with income, or
  // with its one action (adding an income source).
  if (max <= 0 && !action) return null;

  return (
    <section className="card bars-card">
      <div className="bars-card__head">
        <h2>{t(locale, "bars_title")}</h2>
        <p>{t(locale, "bars_sub")}</p>
        {action && (
          <Link href={action.href} className="btn-chip bars-card__action">
            {action.label}
          </Link>
        )}
      </div>
      {max <= 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>
          {t(locale, "bars_empty")}
        </p>
      ) : (
        <div className="bars">
          {/* One neutral ice tint for every month (category colours belong to
              categories, not months); the current month in the primary. */}
          {months.map((month, i) => (
            <div
              className={i === months.length - 1 ? "bar bar--current" : "bar"}
              key={month.start.toISOString()}
            >
              <span
                className="bar__val"
                title={
                  month.unpriced > 0
                    ? t(locale, "income_partial_nights").replace("{n}", String(month.unpriced))
                    : undefined
                }
              >
                {(month.total / 1000).toFixed(1)}
                {month.unpriced > 0 ? "+" : ""}
              </span>
              <span
                className="bar__slab"
                style={{
                  height: `${Math.max(6, Math.round((month.total / max) * 116))}px`,
                  animationDelay: `${i * 0.08}s`,
                }}
              />
              <span className="bar__m">{fmtMonth.format(month.start)}</span>
            </div>
          ))}
        </div>
      )}
      {max > 0 && anyPartial && (
        <p className="field-hint" style={{ margin: "8px 0 0" }}>
          {t(locale, "bars_partial_note")}{" "}
          <Link href="/bookings?show=unpriced" className="link">
            {t(locale, "revenue_partial_link")}
          </Link>
        </p>
      )}
    </section>
  );
}
