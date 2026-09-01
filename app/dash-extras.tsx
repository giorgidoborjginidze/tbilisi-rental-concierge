import Link from "next/link";
import { prisma } from "@/lib/db";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { statusFor, periodAmount } from "@/lib/rentals/monitor";
import { estimateMarketRent, getRentBenchmark } from "@/lib/market/rent";
import { proratedRevenue } from "@/lib/analytics/metrics";
import CountUp from "./count-up";
import DecideCards, { type DecideItem } from "./decide-cards";
import AssetDeckClient, { type DeckAsset, type DeckSlide } from "./asset-deck-client";

// The Ice dashboard pieces shared by every profile: the one hero number,
// the composition ring, and the closing "market advice" feed.

const money = (value: number) => Math.round(value).toLocaleString("en-US");

export function WealthHero({
  label,
  total,
  chips,
}: {
  label: string;
  total: number;
  chips: string[];
}) {
  return (
    <section className="card wealth-hero">
      <div className="wealth-hero__label">{label}</div>
      <div className="wealth-hero__figure">
        <CountUp to={Math.round(total)} /> <small>₾</small>
      </div>
      {chips.length > 0 && (
        <div className="wealth-hero__chips">
          {chips.map((chip) => (
            <span key={chip} className="chip">{chip}</span>
          ))}
        </div>
      )}
    </section>
  );
}

export interface RingPart {
  key: string;
  label: string;
  value: number;
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
}: {
  locale: Locale;
  parts: RingPart[];
}) {
  const shown = parts.filter((part) => part.value > 0);
  if (shown.length < 2) return null; // one colour is not a composition

  const total = shown.reduce((sum, part) => sum + part.value, 0);
  const C = 2 * Math.PI * 49.2;
  let offset = 0;
  const segments = shown.map((part) => {
    const length = (part.value / total) * C;
    const seg = { ...part, length, offset };
    offset += length;
    return seg;
  });
  const short = (value: number) =>
    value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(2)}M`
      : value >= 1_000
        ? `${Math.round(value / 1_000)}K`
        : String(Math.round(value));

  return (
    <section className="card comp-ring">
      <div className="comp-ring__head">
        <h2>{t(locale, "dash_comp_title")}</h2>
        <p>{t(locale, "dash_comp_sub")}</p>
      </div>
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
        <text x="60" y="73" textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--color-text-muted)">
          ₾
        </text>
      </svg>
      <div className="comp-ring__legend">
        {segments.map((seg) => (
          <div key={seg.key}>
            <i style={{ background: `linear-gradient(140deg, ${seg.tint[0]}, ${seg.tint[1]})` }} />
            {seg.label}
            <b>{short(seg.value)}</b>
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}

// ── Market advice: the open alerts, spoken as advice. Nothing renders
// below this section — it closes the dashboard. ──

const TIP_TINTS: Record<string, string> = {
  underpriced: "linear-gradient(140deg,#bdf0e0,#6ed3b8)",
  vacancy_gap: "linear-gradient(140deg,#f9e5b8,#ecc06a)",
  lease_expiry: "linear-gradient(140deg,#d3cbf8,#988ae6)",
  contract_expiry: "linear-gradient(140deg,#d3cbf8,#988ae6)",
  rent_overdue: "linear-gradient(140deg,#f5cdd9,#e08ba4)",
  repossession_right: "linear-gradient(140deg,#f5cdd9,#e08ba4)",
  geofence_breach: "linear-gradient(140deg,#f5cdd9,#e08ba4)",
};
const TIP_GLYPHS: Record<string, string> = {
  underpriced: "↑",
  vacancy_gap: "◔",
  lease_expiry: "◷",
  contract_expiry: "◷",
  rent_overdue: "!",
  repossession_right: "!",
  geofence_breach: "⚑",
};

/** Where each kind of advice actually comes from — stated, not implied. */
const TIP_SOURCE: Record<string, StringKey> = {
  underpriced: "tips_src_bench",
  vacancy_gap: "tips_src_calendar",
  lease_expiry: "tips_src_contract",
  contract_expiry: "tips_src_contract",
  rent_overdue: "tips_src_contract",
  repossession_right: "tips_src_contract",
  geofence_breach: "tips_src_contract",
};

export async function MarketTips({
  locale,
  operatorId,
}: {
  locale: Locale;
  operatorId: string;
}) {
  const alerts = await prisma.alert.findMany({
    where: { operatorId, status: "open" },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <section>
      <h2>{t(locale, "tips_title")}</h2>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: "2px 0 14px" }}>
        {t(locale, "tips_sub")}
      </p>
      {alerts.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
          {t(locale, "tips_empty")}
        </p>
      ) : (
        <div className="tips-grid">
          {alerts.map((alert) => {
            const payload = alert.payload as { assetName?: string; suggestedAction?: string };
            return (
              <div key={alert.id} className="card tip-card">
                <span
                  className="tip-card__ico"
                  style={{ background: TIP_TINTS[alert.type] ?? TIP_TINTS.lease_expiry }}
                >
                  {TIP_GLYPHS[alert.type] ?? "•"}
                </span>
                <div style={{ minWidth: 0 }}>
                  <b className="t">
                    {t(locale, `alert_${alert.type}` as StringKey)}
                    {payload.assetName ? ` — ${payload.assetName}` : ""}
                  </b>
                  <p>
                    {t(locale, `action_${alert.type}` as StringKey)}{" "}
                    <Link href="/alerts" className="link">
                      {t(locale, "tips_open")} →
                    </Link>
                    <span className="tip-card__src">
                      {t(locale, "tips_source")}: {t(locale, TIP_SOURCE[alert.type] ?? "tips_src_contract")}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Ring parts from the operator's assets, valued at estimatedValue. */
export function ringPartsFromAssets(
  locale: Locale,
  assets: { category: string; estimatedValue: number | null }[],
): RingPart[] {
  const byCategory = new Map<string, number>();
  for (const asset of assets) {
    if (!asset.estimatedValue) continue;
    // Holdings (crypto/stock/metal) are valued live elsewhere; physical
    // categories carry their estimate here.
    const key = ["real_estate", "vehicle", "income_source"].includes(asset.category)
      ? asset.category
      : "other";
    byCategory.set(key, (byCategory.get(key) ?? 0) + asset.estimatedValue);
  }
  return [...byCategory.entries()].map(([key, value]) => ({
    key,
    label: t(locale, `category_${key}` as StringKey),
    value,
    tint: CATEGORY_TINTS[key] ?? CATEGORY_TINTS.other,
  }));
}

/** The ring, fetching its own data — one line to add on any dashboard. */
export async function PortfolioRing({
  locale,
  operatorId,
}: {
  locale: Locale;
  operatorId: string;
}) {
  const assets = await prisma.asset.findMany({
    where: { operatorId },
    select: { category: true, estimatedValue: true },
  });
  return <CompositionRing locale={locale} parts={ringPartsFromAssets(locale, assets)} />;
}

/** "To decide today": due and late rent, answered with a flick. */
export async function DecideToday({
  locale,
  operatorId,
}: {
  locale: Locale;
  operatorId: string;
}) {
  const contracts = await prisma.rentalContract.findMany({
    where: {
      status: "active",
      paidThrough: { not: null },
      asset: { operatorId },
    },
    include: { asset: { select: { id: true, name: true, nameKa: true } } },
  });

  const now = new Date();
  const items: DecideItem[] = [];
  for (const contract of contracts) {
    const status = statusFor(contract, now);
    if (!["due", "grace", "repossess"].includes(status.state)) continue;
    const name =
      locale === "ka" && contract.asset.nameKa
        ? contract.asset.nameKa
        : contract.asset.name;
    items.push({
      contractId: contract.id,
      assetId: contract.asset.id,
      title: `${name} — ${t(locale, "decide_rent")}`,
      sub: `${contract.tenantName ?? "—"}${
        status.daysOverdue > 0
          ? ` · ${t(locale, "decide_late")}: ${status.daysOverdue} ${t(locale, "decide_days")}`
          : ""
      }`,
      amount: status.amountDue || periodAmount(contract),
      currency: contract.currency,
      severe: status.state === "repossess",
    });
  }
  items.sort((a, b) => Number(b.severe) - Number(a.severe));

  return (
    <section>
      <h2>{t(locale, "decide_title")}</h2>
      <p className="decide-hint">{t(locale, "decide_sub")}</p>
      <DecideCards
        items={items.slice(0, 4)}
        labels={{
          paid: t(locale, "decide_paid"),
          open: t(locale, "decide_open"),
          empty: t(locale, "decide_empty"),
        }}
      />
    </section>
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
  const assets = await prisma.asset.findMany({
    where: {
      operatorId,
      category: { in: ["real_estate", "vehicle", "other"] },
    },
    include: { contracts: { orderBy: { endDate: "desc" } } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    take: 12,
  });

  if (assets.length === 0) {
    return (
      <section>
        <h2>{t(locale, "deck_title")}</h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
          {t(locale, "deck_empty")}
        </p>
      </section>
    );
  }

  // District rent benchmarks, so the advice can compare against the market.
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const districts = [...new Set(assets.map((a) => a.district).filter(Boolean))] as string[];
  const benchmarks = new Map(
    await Promise.all(
      districts.map(async (d) => [d, await getRentBenchmark(d, monthKey)] as const),
    ),
  );

  const fmtMoney = (value: number) => Math.round(value).toLocaleString("en-US");
  const fmtDate = new Intl.DateTimeFormat(locale === "ka" ? "ka-GE" : "en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  const deck: DeckAsset[] = assets.map((asset) => {
    const contract = asset.contracts.find(
      (c) => c.status !== "ended" && c.startDate <= now && c.endDate >= now,
    );
    const status = contract ? "rented" : asset.unitId ? "str" : asset.status;
    const displayName =
      locale === "ka" && asset.nameKa ? asset.nameKa : asset.name;
    const marketRent =
      asset.category === "real_estate"
        ? estimateMarketRent(asset.areaSqm, benchmarks.get(asset.district ?? "") ?? null)
        : null;

    const slides: DeckSlide[] = [];

    // 1 · What it is worth.
    slides.push({
      kind: "metric",
      label: t(locale, "asset_value_col"),
      value: asset.estimatedValue ? fmtMoney(asset.estimatedValue) : "—",
      unit: asset.estimatedValue ? "₾" : undefined,
      note: marketRent
        ? `${t(locale, "market_rent_est")}: ~${fmtMoney(marketRent)} ₾ / ${t(locale, "per_month_word")}`
        : undefined,
    });

    // 2 · What it earns.
    const dayRate = asset.rentalMode === "daily" ? asset.dailyRate : null;
    slides.push({
      kind: "metric",
      label: t(locale, "deck_rent"),
      value: contract
        ? fmtMoney(contract.monthlyRent)
        : dayRate
          ? fmtMoney(dayRate)
          : "—",
      unit: contract
        ? `₾ / ${t(locale, "per_month_word")}`
        : dayRate
          ? "₾ / 24h"
          : undefined,
      note: contract
        ? `${contract.tenantName ?? "—"} · ${t(locale, "contract_until")} ${fmtDate.format(contract.endDate)}`
        : t(locale, "deck_no_rent"),
    });

    // 3 · Where it stands — the payment schedule when tracked, else status.
    const schedule = contract?.paidThrough ? statusFor(contract, now) : null;
    if (schedule && ["due", "grace", "repossess"].includes(schedule.state)) {
      slides.push({
        kind: "metric",
        label: t(locale, "pay_days_overdue"),
        value: String(schedule.daysOverdue),
        unit: `/ ${schedule.graceDays}`,
        meter: (schedule.daysOverdue / Math.max(1, schedule.graceDays)) * 100,
        tone: schedule.state === "repossess" ? "bad" : undefined,
        note: `${t(locale, "pay_amount_due")}: ${fmtMoney(schedule.amountDue)} ${contract!.currency}`,
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
    if (schedule?.state === "repossess") {
      advice = {
        kind: "advice",
        label: t(locale, "deck_attention"),
        note: t(locale, "deck_adv_repossess"),
        tone: "bad",
      };
    } else if (schedule && (schedule.state === "grace" || schedule.state === "due")) {
      advice = {
        kind: "advice",
        label: t(locale, "deck_attention"),
        note: t(locale, "deck_adv_overdue")
          .replace("{days}", String(schedule.daysOverdue))
          .replace("{grace}", String(schedule.graceDays)),
        tone: "warn",
      };
    } else if (contract && marketRent && contract.monthlyRent < marketRent * 0.9) {
      const pct = Math.round((1 - contract.monthlyRent / marketRent) * 100);
      advice = {
        kind: "advice",
        label: t(locale, "deck_advice"),
        note: t(locale, "deck_adv_underpriced").replace("{pct}", String(pct)),
        tone: "good",
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

    return {
      id: asset.id,
      name: displayName,
      place: [asset.district, asset.address, asset.areaSqm ? `${asset.areaSqm} m²` : null]
        .filter(Boolean)
        .join(" · "),
      category: asset.category,
      badge: asset.category === "vehicle" ? "🚗" : asset.category === "real_estate" ? "🏠" : "📦",
      slides,
    };
  });

  return (
    <section>
      <div className="deck-head">
        <div>
          <h2>{t(locale, "deck_title")}</h2>
          <p>{t(locale, "deck_sub")}</p>
        </div>
        <Link href="/assets" className="btn-chip">
          {t(locale, "deck_all")}
        </Link>
      </div>
      <AssetDeckClient
        assets={deck}
        labels={{ tap: t(locale, "deck_tap"), restart: t(locale, "deck_restart") }}
      />
    </section>
  );
}

// ── Income, six months back, as tinted ice slabs. Combines what the
// platform actually knows: nightly bookings, contracted rent for months
// the contract covered, and manually recorded income. ──

const BAR_TINTS: [string, string][] = [
  ["#a8daf5", "#5ab0e0"],
  ["#bdf0e0", "#6ed3b8"],
  ["#d3cbf8", "#988ae6"],
  ["#a8daf5", "#5ab0e0"],
  ["#bdf0e0", "#6ed3b8"],
  ["#f9e5b8", "#ecc06a"],
];

export async function IncomeBars({
  locale,
  operatorId,
}: {
  locale: Locale;
  operatorId: string;
}) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [bookings, contracts, incomes] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { not: "cancelled" },
        checkIn: { lt: to },
        checkOut: { gt: from },
        unit: { operatorId },
      },
    }),
    prisma.rentalContract.findMany({
      where: { asset: { operatorId }, startDate: { lt: to }, endDate: { gt: from } },
      select: { startDate: true, endDate: true, monthlyRent: true },
    }),
    prisma.incomeRecord.findMany({
      where: { operatorId, date: { gte: from, lt: to } },
      select: { date: true, amount: true },
    }),
  ]);

  const months = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    let total = 0;
    for (const booking of bookings) {
      total += proratedRevenue(booking, { start, end });
    }
    for (const contract of contracts) {
      // Count the contracted rent for any month the contract covered.
      if (contract.startDate < end && contract.endDate > start) {
        total += contract.monthlyRent;
      }
    }
    for (const income of incomes) {
      if (income.date >= start && income.date < end) total += income.amount;
    }
    return { start, total };
  });

  const max = Math.max(...months.map((m) => m.total));
  const fmtMonth = new Intl.DateTimeFormat(locale === "ka" ? "ka-GE" : "en-GB", {
    month: "short",
  });

  return (
    <section className="card bars-card">
      <div className="bars-card__head">
        <h2>{t(locale, "bars_title")}</h2>
        <p>{t(locale, "bars_sub")}</p>
      </div>
      {max <= 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>
          {t(locale, "bars_empty")}
        </p>
      ) : (
        <div className="bars">
          {months.map((month, i) => (
            <div className="bar" key={month.start.toISOString()}>
              <span className="bar__val">{(month.total / 1000).toFixed(1)}</span>
              <span
                className="bar__slab"
                style={{
                  height: `${Math.max(6, Math.round((month.total / max) * 116))}px`,
                  background: `linear-gradient(rgba(255,255,255,.6), rgba(255,255,255,0) 32%),
                    linear-gradient(160deg, ${BAR_TINTS[i][0]}cc 0%, ${BAR_TINTS[i][1]}d9 90%)`,
                  animationDelay: `${i * 0.08}s`,
                }}
              />
              <span className="bar__m">{fmtMonth.format(month.start)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export { money };
