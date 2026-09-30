import Link from "next/link";
import { prisma } from "@/lib/db";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import {
  lateContract,
  periodAmount,
  SETTLEMENT_WINDOW_DAYS,
  statusFor,
} from "@/lib/rentals/terms";
import { currencySign, formatDueMoney, formatMoney, formatNumber } from "@/lib/format";
import { alertSeverity } from "@/lib/ui/tone";
import { alertGlyph } from "./alert-icon";
import { IconArrowRight } from "./icons";
import { alertCategories } from "@/lib/alerts/category";
import { rankAlerts } from "@/lib/alerts/rank";
import {
  activeContract as runningContract,
  activeContractWhere,
  assetStatusNow,
  contractPhase,
  recentlyEndedWhere,
} from "@/lib/rentals/phase";
import { periodWordKey } from "@/lib/rentals/display";
import { templateFamily } from "@/lib/notify/templates";
import { dayKey, monthKeyTbilisi, monthStartTbilisi, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import { estimateMarketRent, getRentBenchmark } from "@/lib/market/rent";
import { monthlyIncomeSeries } from "@/lib/analytics/monthly-income";
import CountUp from "./count-up";
import DecideCards, { type DecideItem } from "./decide-cards";
import AssetDeckClient, { type DeckAsset, type DeckSlide } from "./asset-deck-client";
import DailyCheckClient, { type DayAsset } from "./daily-check-client";
import { dayKind, dayPrice } from "@/lib/assets/daily-price";
import { districtLabel } from "@/lib/places";

// The Ice dashboard pieces shared by every profile: the one hero number,
// the composition ring, and the closing "market advice" feed.

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

// Each tile carries its alert type's line icon on its severity tint —
// the same icon and colour as the card on /alerts (lib/ui/tone.ts).

/** Where each kind of advice actually comes from — stated, not implied. */
const TIP_SOURCE: Record<string, StringKey> = {
  underpriced: "tips_src_bench",
  vacancy_gap: "tips_src_calendar",
  lease_expiry: "tips_src_contract",
  contract_expiry: "tips_src_contract",
  contract_ended: "tips_src_contract",
  rent_overdue: "tips_src_contract",
  repossession_right: "tips_src_contract",
  geofence_breach: "tips_src_gps",
  tracker_silent: "tips_src_gps",
  overlap: "tips_src_calendar",
};

export async function MarketTips({
  locale,
  operatorId,
}: {
  locale: Locale;
  operatorId: string;
}) {
  // The three that matter most — a double booking or the repossession
  // right before any "free window" advice — each named after its unit or
  // asset.
  const ranked = rankAlerts(
    await prisma.alert.findMany({
      where: { operatorId, status: "open" },
      include: { unit: { select: { id: true, name: true, nameKa: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
  // Free windows are listed in one place — the calendar, with a suggested
  // price — so here they take at most one tip that counts them.
  const gaps = ranked.filter((alert) => alert.type === "vacancy_gap");
  const firstGap = ranked.findIndex((alert) => alert.type === "vacancy_gap");
  const alerts = ranked
    .filter((alert, i) => alert.type !== "vacancy_gap" || i === firstGap)
    .slice(0, 3);
  const gapUnits = new Set(gaps.map((alert) => alert.unitId)).size;
  // Older alerts carry no category — it is looked up from the asset.
  const categoryOf = await alertCategories(operatorId, alerts);
  // Named as the owner reads the asset (its Georgian name), not as the
  // payload stored it.
  const assetIds = [
    ...new Set(alerts.map((alert) => (alert.payload as { assetId?: string }).assetId).filter(Boolean)),
  ] as string[];
  const assetNames = new Map(
    (assetIds.length
      ? await prisma.asset.findMany({
          where: { id: { in: assetIds }, operatorId },
          select: { id: true, name: true, nameKa: true },
        })
      : []
    ).map((asset) => [asset.id, locale === "ka" && asset.nameKa ? asset.nameKa : asset.name]),
  );

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
            const payload = alert.payload as {
              assetId?: string;
              assetName?: string;
              suggestedAction?: string;
              category?: string;
            };
            // Late rent on a flat speaks of the lease, not of a vehicle.
            const category = categoryOf(payload);
            const property =
              alert.type === "repossession_right" &&
              category != null &&
              templateFamily(category) === "property";
            const contracts = alert.type === "overlap" && !alert.unit;
            const name = alert.unit
              ? locale === "ka" && alert.unit.nameKa
                ? alert.unit.nameKa
                : alert.unit.name
              : (payload.assetId && assetNames.get(payload.assetId)) || payload.assetName;
            if (alert.type === "vacancy_gap" && gaps.length > 1) {
              return (
                <div key={alert.id} className="card tip-card">
                  <span className="tip-card__ico" data-sev={alertSeverity(alert.type)}>
                    {alertGlyph(alert.type, 19)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <b className="t">
                      {t(locale, "alerts_gaps_title").replace("{n}", String(gaps.length))}
                    </b>
                    <p>
                      {t(locale, "alerts_gaps_detail").replace("{units}", String(gapUnits))}{" "}
                      <Link href="/calendar" className="link icon-text" style={{ gap: 4 }}>
                        {t(locale, "alerts_gaps_open")} <IconArrowRight size={14} />
                      </Link>
                      <span className="tip-card__src">
                        {t(locale, "tips_source")}: {t(locale, TIP_SOURCE.vacancy_gap ?? "tips_src_contract")}
                      </span>
                    </p>
                  </div>
                </div>
              );
            }
            return (
              <div key={alert.id} className="card tip-card">
                <span className="tip-card__ico" data-sev={alertSeverity(alert.type)}>
                  {alertGlyph(alert.type, 19)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <b className="t">
                    {t(
                      locale,
                      property
                        ? "alert_repossession_right_property"
                        : contracts
                          ? "alert_overlap_contract"
                          : (`alert_${alert.type}` as StringKey),
                    )}
                    {name ? ` — ${name}` : ""}
                  </b>
                  <p>
                    {t(
                      locale,
                      property
                        ? "action_repossession_right_property"
                        : contracts
                          ? "action_overlap_contract"
                          : (`action_${alert.type}` as StringKey),
                    )}{" "}
                    <Link
                      href={alert.type === "vacancy_gap" && alert.unit ? `/calendar?unit=${alert.unit.id}` : "/alerts"}
                      className="link icon-text"
                      style={{ gap: 4 }}
                    >
                      {t(locale, "tips_open")} <IconArrowRight size={14} />
                    </Link>
                    <span className="tip-card__src">
                      {t(locale, "tips_source")}:{" "}
                      {t(locale, contracts ? "tips_src_contract" : TIP_SOURCE[alert.type] ?? "tips_src_contract")}
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
  const today = startOfTodayTbilisi();
  // Running contracts by their dates, priced exactly as the rental page
  // and the WhatsApp message price them (weekend and holiday days too) —
  // and recently finished ones that still have rent owed, so the money
  // can be recorded when the renter pays.
  const contracts = await prisma.rentalContract.findMany({
    where: {
      OR: [
        activeContractWhere(today),
        recentlyEndedWhere(today, SETTLEMENT_WINDOW_DAYS),
      ],
      paidThrough: { not: null },
      asset: { operatorId },
    },
    include: {
      asset: {
        select: {
          id: true, name: true, nameKa: true,
          dailyRate: true, weekendPct: true, holidayPct: true,
        },
      },
    },
  });

  const items: DecideItem[] = [];
  for (const contract of contracts) {
    const status = statusFor(contract, today, contract.asset);
    if (!["due", "grace", "repossess"].includes(status.state)) continue;
    const ended = contractPhase(contract, today) === "ended";
    const name =
      locale === "ka" && contract.asset.nameKa
        ? contract.asset.nameKa
        : contract.asset.name;
    items.push({
      contractId: contract.id,
      assetId: contract.asset.id,
      name,
      title: `${name} — ${t(locale, "decide_rent")}`,
      sub: `${contract.tenantName ?? "—"}${ended ? ` · ${t(locale, "cstatus_ended")}` : ""}${
        status.daysOverdue > 0
          ? ` · ${t(locale, "decide_late")}: ${status.daysOverdue} ${t(locale, "decide_days")}`
          : ""
      }`,
      amount: status.amountDue || periodAmount(contract),
      currency: contract.currency,
      periodsOwed: status.periodsOwed,
      severe: status.state === "repossess",
    });
  }
  // Most urgent first: past the grace period, then the longest late.
  items.sort(
    (a, b) =>
      Number(b.severe) - Number(a.severe) || b.periodsOwed - a.periodsOwed,
  );

  const errorKeys: StringKey[] = [
    "error_required",
    "error_invalid_number",
    "error_untracked",
    "error_payment_locked",
    "error_demo_readonly",
  ];
  return (
    <section>
      <h2>{t(locale, "decide_title")}</h2>
      <p className="decide-hint">{t(locale, "decide_sub")}</p>
      {/* Every late rent is listed — the first few, then "show all". */}
      <DecideCards
        items={items}
        labels={{
          paid: t(locale, "decide_paid"),
          open: t(locale, "decide_open"),
          empty: t(locale, "decide_empty"),
          confirm: t(locale, "decide_confirm"),
          confirmYes: t(locale, "decide_confirm_yes"),
          confirmNo: t(locale, "decide_confirm_no"),
          recorded: t(locale, "decide_recorded"),
          undo: t(locale, "decide_undo"),
          undone: t(locale, "decide_undone"),
          error: t(locale, "decide_error"),
          showAll: t(locale, "decide_show_all"),
          showLess: t(locale, "decide_show_less"),
          close: t(locale, "bot_close"),
          errors: Object.fromEntries(errorKeys.map((key) => [key, t(locale, key)])),
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
  const today = startOfTodayTbilisi(now);
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
  const monthKey = monthKeyTbilisi(now);
  const districts = [...new Set(assets.map((a) => a.district).filter(Boolean))] as string[];
  const benchmarks = new Map(
    await Promise.all(
      districts.map(async (d) => [d, await getRentBenchmark(d, monthKey)] as const),
    ),
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
        : assetStatusNow(asset, asset.contracts, today);
    const property = templateFamily(asset.category) === "property";
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
    // The rent per period as agreed — "60 ₾ / day", not a day rate
    // passed off as a month.
    slides.push({
      kind: "metric",
      label: t(locale, "deck_rent"),
      value: contract
        ? formatNumber(periodAmount(contract), 2)
        : dayRate
          ? fmtMoney(dayRate)
          : "—",
      unit: contract
        ? `${currencySign(contract.currency)} / ${t(locale, periodWordKey(contract.paymentPeriod))}`
        : dayRate
          ? `₾ / ${t(locale, "per_day_word")}`
          : undefined,
      note: contract
        ? `${contract.tenantName ?? "—"} · ${t(locale, "contract_until")} ${fmtDate.format(contract.endDate)}`
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
      place: [districtLabel(locale, asset.district), asset.address, asset.areaSqm ? `${asset.areaSqm} m²` : null]
        .filter(Boolean)
        .join(" · "),
      category: asset.category,
      badge: asset.category,
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

/**
 * The daily question: for every asset let by the day, was it rented today
 * and for how much. The suggestion is the day's tariff — base rate plus
 * the weekend or holiday premium — so a public holiday proposes the
 * holiday price rather than the ordinary one.
 */
export async function DailyCheck({
  locale,
  operatorId,
}: {
  locale: Locale;
  operatorId: string;
}) {
  // Tbilisi's today: an answer given at 01:30 belongs to the new day,
  // at that day's tariff.
  const today = startOfTodayTbilisi();

  const assets = await prisma.asset.findMany({
    where: { operatorId, rentalMode: "daily" },
    include: { days: { where: { date: today } } },
    orderBy: { name: "asc" },
  });
  if (assets.length === 0) return null;

  const iso = dayKey(today);
  const rows: DayAsset[] = assets.map((asset) => {
    const base = asset.dailyRate ?? 0;
    const entry = asset.days[0];
    return {
      id: asset.id,
      name: locale === "ka" && asset.nameKa ? asset.nameKa : asset.name,
      place: [districtLabel(locale, asset.district), asset.address].filter(Boolean).join(" · "),
      date: iso,
      suggested: dayPrice(today, base, asset.weekendPct ?? 0, asset.holidayPct ?? 0),
      currency: asset.currency,
      kind: dayKind(today),
      answered: entry ? { rented: entry.rented, amount: entry.amount } : null,
    };
  });

  const earned = rows.reduce(
    (sum, row) => sum + (row.answered?.rented ? row.answered.amount : 0),
    0,
  );
  const currency = rows[0]?.currency ?? "GEL";

  const labelKeys: StringKey[] = [
    "day_amount", "day_yes", "day_no", "day_edit",
    "day_holiday", "day_weekend", "day_base",
    "error_required", "error_invalid_number",
  ];
  const labels = Object.fromEntries(
    labelKeys.map((key) => [key, t(locale, key)]),
  );

  return (
    <section>
      <div className="deck-head">
        <div>
          <h2>{t(locale, "day_title")}</h2>
          <p>{t(locale, "day_sub")}</p>
        </div>
        {earned > 0 && (
          <span className="daily-total">
            {t(locale, "day_earned")}: <b>{formatMoney(earned, currency)}</b>
          </span>
        )}
      </div>
      <DailyCheckClient assets={rows} labels={labels} />
    </section>
  );
}

