import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { periodAmount, SETTLEMENT_WINDOW_DAYS, statusFor } from "@/lib/rentals/terms";
import { activeContractWhere, contractPhase, recentlyEndedWhere } from "@/lib/rentals/phase";
import { deskHref, rentalDesk } from "@/lib/rentals/desk";
import { templateFamily } from "@/lib/notify/templates";
import { groupAlerts, type AlertGroup } from "@/lib/alerts/groups";
import { alertHref } from "@/lib/alerts/links";
import { URGENT_TYPES } from "@/lib/alerts/rank";
import { foldIntoCards, rentCardRank, todaySegments } from "@/lib/dashboard/today";
import { silenceSpan } from "@/lib/geo/silence";
import { checkTrackerSilenceSoon } from "@/lib/geo/silence-check";
import { alertSeverity } from "@/lib/ui/tone";
import { dayKey, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import { formatMoney } from "@/lib/format";
import { districtLabel } from "@/lib/places";
import { dayKind, dayPrice } from "@/lib/assets/daily-price";
import { loadAssetSources } from "@/lib/property/places";
import { contractNightValue, placeStays } from "@/lib/property/stays";
import { asksDailyQuestion } from "@/lib/property/link";
import { alertGlyph } from "./alert-icon";
import { IconArrowRight } from "./icons";
import DecideCards, { DecideToastHost, type DecideItem } from "./decide-cards";
import DailyCheckClient, { type DayAsset } from "./daily-check-client";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { LIVE_STAY } from "@/lib/bookings/live";

// "Today": the one block under the hero that says what needs the owner
// today — urgent alerts (a double booking, the repossession right, a red
// line, a silent tracker), rent that is due or late as swipe cards, the
// daily "rented today?" question, and the profile's own moves of the day
// (a hotel's arrivals and departures, a fleet's handovers and returns).
// One line per place, the most severe first (lib/dashboard/today.ts).

const DAY_MS = 86_400_000;

const nameOf = (locale: Locale, row: { name: string; nameKa: string | null }) =>
  locale === "ka" && row.nameKa ? row.nameKa : row.name;

// ── Rent due or late: every running contract past a due date, and finished
// ones that still owe (within the settlement window). ──
async function loadRentItems(locale: Locale, operatorId: string, today: Date): Promise<DecideItem[]> {
  const contracts = await prisma.rentalContract.findMany({
    where: {
      OR: [activeContractWhere(today), recentlyEndedWhere(today, SETTLEMENT_WINDOW_DAYS)],
      paidThrough: { not: null },
      asset: { operatorId },
      ...LIVE_CONTRACT,
    },
    include: {
      asset: {
        select: {
          id: true, name: true, nameKa: true, category: true,
          dailyRate: true, weekendPct: true, holidayPct: true,
        },
      },
    },
  });

  const items: DecideItem[] = [];
  for (const contract of contracts) {
    // Priced exactly as the rental page and the WhatsApp text price it.
    const status = statusFor(contract, today, contract.asset);
    if (!["due", "grace", "repossess"].includes(status.state)) continue;
    const ended = contractPhase(contract, today) === "ended";
    const name = nameOf(locale, contract.asset);
    const desk = rentalDesk(contract.asset.category, 1);
    items.push({
      contractId: contract.id,
      assetId: contract.asset.id,
      href: desk ? deskHref(contract.asset.id, desk, "payments") : `/assets/${contract.asset.id}/edit#contracts`,
      name,
      title: `${name} — ${t(locale, "decide_rent")}`,
      sub: [
        contract.tenantName,
        ended ? t(locale, "cstatus_ended") : null,
        status.daysOverdue > 0
          ? `${t(locale, "decide_late")}: ${status.daysOverdue} ${t(locale, "decide_days")}`
          : t(locale, "decide_due_today"),
      ]
        .filter(Boolean)
        .join(" · "),
      amount: status.amountDue || periodAmount(contract),
      currency: contract.currency,
      periodsOwed: status.periodsOwed,
      severe: status.state === "repossess",
      vehicle: contract.asset.category === "vehicle",
      flags: [],
    });
  }
  return items;
}

// ── The daily question: for every asset let by the day, was it rented
// today and for how much (the day's tariff, weekend and holiday included).
// A night a booking, lease or contract already holds is shown as answered
// by it (lib/property/stays.ts). A flat whose calendar unit syncs channel
// feeds is not asked at all: the channel is the record of its nights. ──
async function loadDaily(locale: Locale, operatorId: string, today: Date) {
  const assets = (
    await prisma.asset.findMany({
      where: { operatorId, rentalMode: "daily" },
      include: {
        days: { where: { date: today } },
        unit: {
          select: {
            operatorId: true,
            channelLinks: true,
            _count: { select: { bookings: { where: LIVE_STAY } } },
          },
        },
      },
      orderBy: { name: "asc" },
    })
  ).filter((asset) =>
    asksDailyQuestion({
      rentalMode: asset.rentalMode,
      // Only this workspace's own unit speaks for the flat.
      unit:
        asset.unit && asset.unit.operatorId === operatorId
          ? { channelLinks: asset.unit.channelLinks, bookings: asset.unit._count.bookings }
          : null,
    }),
  );
  if (assets.length === 0) return null;

  const tomorrow = new Date(today.getTime() + DAY_MS);
  const sourcesOf = await loadAssetSources(
    operatorId,
    assets.map((asset) => asset.id),
    { start: today, end: tomorrow },
  );
  const coverOf = (assetId: string): (NonNullable<DayAsset["covered"]> & { contractId?: string }) | null => {
    const src = sourcesOf.get(assetId);
    const stay = src ? placeStays(src).find((s) => s.start <= today && s.end > today) : undefined;
    if (!src || !stay) return null;
    if (stay.record === "booking") {
      const booking = src.bookings.find((b) => b.id === stay.id);
      return {
        label:
          stay.kind === "airbnb"
            ? "Airbnb"
            : stay.kind === "booking"
              ? "Booking.com"
              : t(locale, stay.kind === "direct" ? "source_direct" : "source_manual"),
        amount: booking?.amount != null && booking.nights > 0 ? booking.amount / booking.nights : null,
      };
    }
    if (stay.record === "contract") {
      const contract = src.contracts.find((c) => c.id === stay.id);
      return {
        label: t(locale, "overlap_src_contract"),
        amount: contract && src.dailyMode ? contractNightValue(contract, today.getTime(), src) : null,
        contractId: stay.id,
      };
    }
    return { label: t(locale, "overlap_src_lease"), amount: null };
  };

  const iso = dayKey(today);
  const rows: DayAsset[] = assets.map((asset) => {
    const entry = asset.days[0];
    return {
      covered: coverOf(asset.id),
      id: asset.id,
      name: nameOf(locale, asset),
      place: [districtLabel(locale, asset.district), asset.address].filter(Boolean).join(" · "),
      date: iso,
      suggested: dayPrice(today, asset.dailyRate ?? 0, asset.weekendPct ?? 0, asset.holidayPct ?? 0),
      currency: asset.currency,
      kind: dayKind(today),
      answered: entry ? { rented: entry.rented, amount: entry.amount } : null,
    };
  });
  return { rows, currency: rows[0]?.currency ?? "GEL" };
}

/** What the daily rows earned today — a late contract's day counts nothing. */
function dailyEarned(rows: DayAsset[]): number {
  return rows.reduce(
    (sum, row) =>
      sum +
      (row.covered
        ? row.covered.late
          ? 0
          : row.covered.amount ?? 0
        : row.answered?.rented
          ? row.answered.amount
          : 0),
    0,
  );
}

interface UrgentAlert {
  id: string;
  type: string;
  createdAt: Date;
  unitId: string | null;
  payload: unknown;
  unit: { id: string; name: string; nameKa: string | null } | null;
}

export async function TodaySection({
  locale,
  operatorId,
  moves,
  fleetLink = false,
}: {
  locale: Locale;
  operatorId: string;
  /** The profile's own moves of the day (arrivals/departures, handovers/returns). */
  moves?: ReactNode;
  /** A car rental: the rent cards link to the whole fleet list. */
  fleetLink?: boolean;
}) {
  const now = new Date();
  const today = startOfTodayTbilisi(now);
  // A tracker that went quiet since the last check is in this list today,
  // not after tomorrow's scan (throttled: at most every few minutes).
  await checkTrackerSilenceSoon(operatorId, now);

  const [items, daily, urgent, linked] = await Promise.all([
    loadRentItems(locale, operatorId, today),
    loadDaily(locale, operatorId, today),
    prisma.alert.findMany({
      where: { operatorId, status: "open", type: { in: [...URGENT_TYPES] } },
      include: { unit: { select: { id: true, name: true, nameKa: true } } },
      take: 200,
    }),
    // A unit and the asset linked to it are one place.
    prisma.asset.findMany({
      where: { operatorId, unitId: { not: null } },
      select: { id: true, unitId: true },
    }),
  ]);
  const unitOfAsset = new Map(linked.map((asset) => [asset.id, asset.unitId!]));

  // A day held by a contract whose driver is past the grace period (the
  // repossession right) is a warning in the daily list, not a rented day.
  const lateContract = new Map(items.filter((item) => item.severe).map((item) => [item.contractId, item]));
  for (const row of daily?.rows ?? []) {
    const id = (row.covered as { contractId?: string } | null)?.contractId;
    const late = id ? lateContract.get(id) : undefined;
    if (row.covered && late) row.covered = { ...row.covered, late: `${t(locale, "daily_late_warn")} · ${late.sub}` };
  }
  const earned = daily ? dailyEarned(daily.rows) : 0;

  // Names and desks of the assets the alerts are about — the name the owner
  // reads, not the one stored in the payload.
  const assetIds = [
    ...new Set(
      urgent.map((alert) => (alert.payload as { assetId?: string } | null)?.assetId).filter(Boolean),
    ),
  ] as string[];
  const assets = assetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds }, operatorId },
        select: { id: true, name: true, nameKa: true, category: true, _count: { select: { contracts: { where: LIVE_CONTRACT } } } },
      })
    : [];
  const assetBy = new Map(assets.map((asset) => [asset.id, asset]));
  const deskOf = (assetId: string) => {
    const asset = assetBy.get(assetId);
    return asset ? rentalDesk(asset.category, asset._count.contracts) : null;
  };
  // The category (a flat's lease is not a car to take back) comes with the
  // asset read just above — no second lookup.
  const categoryOf = (payload: { assetId?: string; category?: string } | null) =>
    payload?.category ?? (payload?.assetId ? assetBy.get(payload.assetId)?.category : undefined) ?? null;
  const isProperty = (alert: UrgentAlert) => {
    const category = categoryOf(alert.payload as { assetId?: string; category?: string } | null);
    return category != null && templateFamily(category) === "property";
  };

  // One line per place: a late car's red line and silent tracker ride on
  // its rent card; other places get a row.
  const groups = groupAlerts(urgent, unitOfAsset);
  const { rows, flags } = foldIntoCards(groups, items);

  const title = (alert: UrgentAlert): string =>
    t(
      locale,
      alert.type === "repossession_right" && isProperty(alert)
        ? "alert_repossession_right_property"
        : alert.type === "overlap" && !alert.unitId
          ? "alert_overlap_contract"
          : (`alert_${alert.type}` as StringKey),
    );

  const fmtDay = tbilisiFormat(locale, { day: "numeric", month: "short" });
  const day = (key: unknown) =>
    typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key) ? fmtDay.format(new Date(`${key}T00:00:00Z`)) : null;

  // One phrase per kind of alert on a line: what it is, and its figure.
  const issue = (kind: { type: string; alerts: UrgentAlert[] }): string => {
    const first = kind.alerts[0];
    const payload = (first.payload ?? {}) as {
      start?: string;
      end?: string;
      fenceName?: string;
      lastPingAt?: string;
    };
    const count = kind.alerts.length > 1 ? ` (${kind.alerts.length})` : "";
    switch (kind.type) {
      case "overlap": {
        const from = day(payload.start);
        const to = day(payload.end);
        return `${title(first)}${count}${from ? ` · ${from}${to ? `–${to}` : ""}` : ""}`;
      }
      case "geofence_breach":
        return `${title(first)}${count}${payload.fenceName ? ` · ${payload.fenceName}` : ""}`;
      case "tracker_silent": {
        // "Tracker silent · 5 h".
        const span = payload.lastPingAt ? silenceSpan(new Date(payload.lastPingAt), now) : null;
        return span
          ? `${title(first)} · ${t(locale, `dur_${span.unit}` as StringKey).replace("{n}", String(span.n))}`
          : title(first);
      }
      default:
        return `${title(first)}${count}`;
    }
  };

  const placeName = (group: AlertGroup<UrgentAlert>): string => {
    const unit = group.alerts.find((alert) => alert.unit)?.unit;
    if (unit) return nameOf(locale, unit);
    const asset = group.assetId ? assetBy.get(group.assetId) : undefined;
    if (asset) return nameOf(locale, asset);
    return (group.alerts[0].payload as { assetName?: string } | null)?.assetName ?? "—";
  };

  // The flags a rent card carries, in its own words.
  for (const item of items) {
    const types = flags.get(item.contractId) ?? [];
    const group = groups.find((g) => g.assetId === item.assetId);
    item.flags = types.map((type) => {
      const kind = group?.kinds.find((k) => k.type === type);
      // Only this contract's own alerts of the kind (and the car's own).
      const own = kind?.alerts.filter((alert) => {
        const id = (alert.payload as { contractId?: string } | null)?.contractId;
        return !id || id === item.contractId;
      });
      return {
        label: kind && own?.length ? issue({ type, alerts: own }) : t(locale, `alert_${type}` as StringKey),
        tone: alertSeverity(type) === "danger" ? "danger" : "warn",
      };
    });
  }
  // Most urgent first: the most severe thing a card carries (a double
  // booking, past the grace period, outside the red line), then the most
  // periods owed. Rows and cards are then merged by severity, so a row is
  // never below a milder card (lib/dashboard/today.ts).
  const cardRank = (item: DecideItem) =>
    rentCardRank({ severe: item.severe, flags: flags.get(item.contractId) ?? [] });
  items.sort((a, b) => cardRank(a) - cardRank(b) || b.periodsOwed - a.periodsOwed);
  const segments = todaySegments(rows, items, cardRank);

  const rowList = (list: typeof rows) =>
    list.length === 0 ? null : (
      <ul className="today-rows">
        {list.map((group) => {
          const first = group.alerts[0];
          const sev = alertSeverity(first.type);
          return (
            <li key={group.key}>
              <Link href={alertHref(first, deskOf)} className="today-row" data-sev={sev}>
                <span className="today-row__ico" data-sev={sev} aria-hidden>
                  {alertGlyph(first.type, 18)}
                </span>
                <span className="today-row__txt">
                  <b>{placeName(group)}</b>
                  <span>{group.kinds.map((kind) => issue(kind)).join(" · ")}</span>
                </span>
                <IconArrowRight size={16} />
              </Link>
            </li>
          );
        })}
      </ul>
    );

  const errorKeys: StringKey[] = [
    "error_required",
    "error_invalid_number",
    "error_untracked",
    "error_payment_locked",
    "error_demo_readonly",
  ];
  const dailyKeys: StringKey[] = [
    "day_amount", "day_yes", "day_no", "day_edit",
    "day_holiday", "day_weekend", "day_base",
    "error_required", "error_invalid_number",
  ];
  // Nothing urgent and no rent due: said in so many words, whatever the
  // day's moves or daily question below it hold.
  const nothing = rows.length === 0 && items.length === 0;
  const decideLabels = {
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
  };
  const firstCards = segments.findIndex((segment) => segment.kind === "cards");

  return (
    <section className="card today" aria-labelledby="today-title">
      <div className="today__head">
        <h2 id="today-title">{t(locale, "today_title")}</h2>
        <span className="today__date">
          {tbilisiFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now)}
        </span>
      </div>

      <DecideToastHost labels={decideLabels}>
      {segments.map((segment, i) =>
        segment.kind === "rows" ? (
          <Fragment key={`r${i}`}>{rowList(segment.items)}</Fragment>
        ) : (
          <div key={`c${i}`} className={`today-block${i === firstCards ? "" : " today-block--more"}`}>
            {/* The heading and hint once, on the first block of cards; a
                milder block further down continues it. */}
            {i === firstCards && (
              <>
                <div className="today-block__head">
                  <h3>
                    {t(locale, "today_rent_title")}
                    <span className="today-count">{items.length}</span>
                  </h3>
                  {(fleetLink || items.some((item) => item.vehicle)) && (
                    <Link href="/fleet" className="link icon-text" style={{ gap: 4 }}>
                      {t(locale, "today_fleet_all")} <IconArrowRight size={14} />
                    </Link>
                  )}
                </div>
                <p className="decide-hint">{t(locale, "decide_sub")}</p>
              </>
            )}
            {/* Every late rent is listed — the first few, then "all (N)". */}
            <DecideCards items={segment.items} />
          </div>
        ),
      )}
      </DecideToastHost>

      {nothing && <p className="today__clear">{t(locale, "today_clear")}</p>}

      {moves}

      {daily && (
        <div className="today-block">
          <div className="today-block__head">
            <h3>{t(locale, "today_daily")}</h3>
            {earned > 0 && (
              <span className="daily-total">
                {t(locale, "day_earned")}: <b>{formatMoney(earned, daily.currency)}</b>
              </span>
            )}
          </div>
          {/* The question only while a row still asks it. */}
          <p className="decide-hint">
            {t(locale, daily.rows.some((row) => !row.covered && !row.answered) ? "day_sub" : "day_sub_done")}
          </p>
          <DailyCheckClient
            assets={daily.rows}
            labels={Object.fromEntries(dailyKeys.map((key) => [key, t(locale, key)]))}
          />
        </div>
      )}

    </section>
  );
}

/**
 * A day's moves as a compact two-column list: a hotel's arrivals and
 * departures, a fleet's handovers and returns.
 */
export function TodayMoves({
  columns,
}: {
  columns: {
    title: string;
    empty: string;
    rows: { key: string; href: string; name: string; sub: string; aside?: ReactNode }[];
  }[];
}) {
  return (
    <div className="today-block today-moves">
      {columns.map((column) => (
        <div key={column.title} className="today-moves__col">
          <h3>
            {column.title}
            <span className="today-count">{column.rows.length}</span>
          </h3>
          {column.rows.length === 0 ? (
            <p className="today__none">{column.empty}</p>
          ) : (
            <ul className="today-moves__list">
              {column.rows.map((row) => (
                <li key={row.key}>
                  <span className="today-moves__txt">
                    <Link href={row.href} className="link">
                      {row.name}
                    </Link>
                    <span>{row.sub}</span>
                  </span>
                  {row.aside}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
