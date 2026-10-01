import type { ReactNode } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { reopenAlerts, runAlertScan, setAlertStatus } from "@/lib/alerts/actions";
import { groupAlerts } from "@/lib/alerts/groups";
import { alertHref } from "@/lib/alerts/links";
import { alertCategories } from "@/lib/alerts/category";
import { templateFamily } from "@/lib/notify/templates";
import { periodWordKey } from "@/lib/rentals/display";
import { statusFor } from "@/lib/rentals/terms";
import { formatDueMoney, formatMoney, formatNumber } from "@/lib/format";
import { silenceSpan } from "@/lib/geo/silence";
import { WITHDRAW_REASONS } from "@/lib/rentals/settle";
import type { ScheduleStatus } from "@/lib/rentals/schedule";
import { dayKey, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import { lastRunFor } from "@/lib/automation/run";
import { ADVICE_TYPES, alertRank, NEEDS_YOU_TYPES, rankAlerts } from "@/lib/alerts/rank";
import { firstParam, type QueryValue } from "@/lib/params";
import { titled } from "@/lib/i18n/metadata";
import { alertCardClass, badgeClass, endedAlertSeverity } from "@/lib/ui/tone";
import { AlertTypeIcon } from "../alert-icon";
import { IconArrowRight, IconChevronDown } from "../icons";
import OutboxList, { type OutboxItem } from "../outbox-list";
import { deskHref, rentalDesk } from "@/lib/rentals/desk";
import { autoSendFor } from "@/lib/notify/whatsapp";
import { outboxView } from "@/lib/notify/outbox-view";
import { staleMessageReasons } from "@/lib/rentals/settle";
import { retryOutbox } from "@/lib/rentals/actions";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { checkTrackerSilenceSoon } from "@/lib/geo/silence-check";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("alerts_title");

interface OverlapStay {
  source?: string;
  start?: string;
  end?: string;
  tenantName?: string | null;
}

interface AlertPayload {
  start?: string;
  end?: string;
  nights?: number;
  /** Free window with nothing booked after it (within the horizon). */
  openEnd?: boolean;
  /** Double booking: the two stays or contracts. */
  stays?: OverlapStay[];
  endDate?: string;
  tenantName?: string | null;
  daysLeft?: number;
  month?: string;
  benchmarkAdr?: number;
  suggestedRate?: number;
  baseNightlyRate?: number;
  assetId?: string;
  assetName?: string;
  monthlyRent?: number;
  paymentAmount?: number | null;
  paymentPeriod?: string;
  category?: string;
  // Car rentals: late payment and red-line crossings.
  plate?: string | null;
  currency?: string;
  dueDate?: string;
  daysOverdue?: number;
  graceDays?: number;
  amountDue?: number;
  repossessFrom?: string;
  tenantPhone?: string | null;
  fenceName?: string;
  lat?: number;
  lng?: number;
  distanceKm?: number;
  driverName?: string | null;
  contractId?: string;
  // Silent tracker.
  deviceId?: string;
  lastPingAt?: string;
  /** Set when the system (not the owner) closed the alert. */
  autoResolved?: string;
}

/** At most this many open alerts of each list (needs you / advice) are read. */
const OPEN_LIMIT = 200;

/** The kind filters on the open list (?type=): what each one shows. */
const ALERT_FILTERS: { key: string; label: StringKey; types: string[] }[] = [
  { key: "rent", label: "alerts_filter_rent", types: ["rent_overdue", "repossession_right", "contract_ended"] },
  { key: "gps", label: "alerts_filter_gps", types: ["geofence_breach", "tracker_silent"] },
  { key: "calendar", label: "alerts_filter_calendar", types: ["overlap", "vacancy_gap", "underpriced"] },
  { key: "contracts", label: "alerts_filter_contracts", types: ["contract_expiry", "lease_expiry"] },
];

/** Alert types whose figures are read live from their contract. */
const CONTRACT_ALERTS = ["rent_overdue", "repossession_right", "contract_ended"];

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: QueryValue;
    tab?: QueryValue;
    closed?: QueryValue;
    g?: QueryValue;
    type?: QueryValue;
    scanned?: QueryValue;
  }>;
}) {
  const operator = await requireOperator();
  await checkTrackerSilenceSoon(operator.id);

  const query = await searchParams;
  const view = firstParam(query.view);
  // The group the owner was working in stays open after a tap.
  const focusGroup = firstParam(query.g) ?? null;
  // What was just closed, for the undo.
  const closedIds = (firstParam(query.closed) ?? "")
    .split(",")
    .filter((id) => /^[a-z0-9]{8,40}$/i.test(id))
    .slice(0, 400);
  // Three views: open alerts, the workspace-wide outbox, handled alerts.
  const outbox = firstParam(query.tab) === "outbox";
  const done = !outbox && view === "done";
  const locale = await getLocale();
  const unitSelect = { unit: { select: { id: true, name: true, nameKa: true, currency: true } } } as const;
  // Open alerts are read in two capped lists — what needs the owner and the
  // advice — so a long tail of free windows can never push a late rent or a
  // double booking out of the page. The handled view lists both what was
  // done and what was hidden, so a hidden alert can be brought back.
  const [urgentFound, adviceFound] = done
    ? [
        await prisma.alert.findMany({
          where: { operatorId: operator.id, status: { in: ["resolved", "dismissed"] } },
          include: unitSelect,
          orderBy: { resolvedAt: "desc" },
          take: 50,
        }),
        [],
      ]
    : await Promise.all([
        prisma.alert.findMany({
          where: { operatorId: operator.id, status: "open", type: { in: [...NEEDS_YOU_TYPES] } },
          include: unitSelect,
          orderBy: { createdAt: "desc" },
          take: OPEN_LIMIT,
        }),
        prisma.alert.findMany({
          where: { operatorId: operator.id, status: "open", type: { notIn: [...NEEDS_YOU_TYPES] } },
          include: unitSelect,
          orderBy: { createdAt: "desc" },
          take: OPEN_LIMIT,
        }),
      ]);
  const found = [...urgentFound, ...adviceFound];
  // Only when a list was cut: how many are open in all.
  const openTotal =
    !done && (urgentFound.length === OPEN_LIMIT || adviceFound.length === OPEN_LIMIT)
      ? await prisma.alert.count({ where: { operatorId: operator.id, status: "open" } })
      : null;
  // Open alerts: what costs money or the car today comes first — of one
  // kind only when the owner picked a filter (rent, GPS, calendar…).
  const typeFilter = ALERT_FILTERS.find((filter) => filter.key === firstParam(query.type)) ?? null;
  // Advice about days already over (a free window that has passed, a
  // month gone by) waits for the next scan to close it — it is not shown.
  const todayKey0 = dayKey(startOfTodayTbilisi());
  const pastAdvice = (alert: { type: string; payload: unknown }) => {
    const payload = (alert.payload ?? {}) as AlertPayload;
    if (alert.type === "vacancy_gap") return !payload.openEnd && !!payload.end && payload.end <= todayKey0;
    if (alert.type === "underpriced") return !!payload.month && payload.month < todayKey0.slice(0, 7);
    return false;
  };
  const alerts = (done ? found : rankAlerts(found).filter((alert) => !pastAdvice(alert))).filter(
    (alert) => !typeFilter || typeFilter.types.includes(alert.type),
  );
  // A manual "scan now" just ran: said, with what it found.
  const scannedRaw = firstParam(query.scanned);
  const scanned = scannedRaw != null && /^\d{1,4}$/.test(scannedRaw) ? Number(scannedRaw) : null;
  const lastRun = done ? null : await lastRunFor(operator.id);
  // A unit and the asset linked to it are one place: one group.
  const linkedAssets = done
    ? []
    : await prisma.asset.findMany({
        where: { operatorId: operator.id, unitId: { not: null } },
        select: { id: true, unitId: true },
      });
  const groups = done ? [] : groupAlerts(alerts, new Map(linkedAssets.map((a) => [a.id, a.unitId!])));
  // Just closed (still closed): offered back with one tap.
  const justClosed =
    !done && !outbox && closedIds.length > 0
      ? await prisma.alert.count({
          where: { id: { in: closedIds }, operatorId: operator.id, status: { in: ["resolved", "dismissed"] } },
        })
      : 0;

  // ── The outbox: every message of every asset, one list ──
  const now0 = new Date();
  const today0 = startOfTodayTbilisi(now0);
  const autoSend = await autoSendFor(operator.id);
  const messageRows = await prisma.notifyMessage.findMany({
    where: {
      operatorId: operator.id,
      OR: [
        { status: { in: ["queued", "failed", "sending"] } },
        { createdAt: { gte: new Date(now0.getTime() - 8 * 86_400_000) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const messageAssetIds = [
    ...new Set(messageRows.map((message) => message.assetId).filter(Boolean)),
  ] as string[];
  const messageAssets = messageAssetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: messageAssetIds }, operatorId: operator.id },
        select: { id: true, name: true, nameKa: true, category: true, _count: { select: { contracts: { where: LIVE_CONTRACT } } } },
      })
    : [];
  const messageAssetBy = new Map(messageAssets.map((asset) => [asset.id, asset]));
  // What no longer holds is never offered for sending, whatever its kind
  // (paid rent, a car back inside its line, hours-old red-line news, an
  // objecting renter, a draft in the account's earlier language) — even
  // before the next check withdraws it.
  const staleBy = await staleMessageReasons(
    prisma,
    messageRows.filter((message) => message.status === "queued" || message.status === "failed"),
    today0,
    now0,
  );
  const outboxItems: OutboxItem[] = messageRows.map((message) => {
    const asset = message.assetId ? messageAssetBy.get(message.assetId) : undefined;
    const desk = asset ? rentalDesk(asset.category, asset._count.contracts) : null;
    return {
      ...message,
      stale: staleBy.get(message.id) ?? null,
      property: asset ? asset.category !== "vehicle" : false,
      asset: asset
        ? {
            name: locale === "ka" && asset.nameKa ? asset.nameKa : asset.name,
            href: desk ? deskHref(asset.id, desk, "messages") : `/assets/${asset.id}/edit`,
          }
        : null,
    };
  });
  const outboxNow = outboxView(outboxItems, autoSend, now0);
  // Messages waiting per asset, for the alert cards' "messages" link.
  const waitingByAsset = new Map<string, number>();
  for (const item of outboxNow.waiting) {
    if (item.assetId) waitingByAsset.set(item.assetId, (waitingByAsset.get(item.assetId) ?? 0) + 1);
  }

  // Older alerts carry no category — it is looked up from the asset.
  const categoryOf = await alertCategories(operator.id, alerts);

  const displayName = (unit: { name: string; nameKa: string | null } | null) =>
    unit ? (locale === "ka" && unit.nameKa ? unit.nameKa : unit.name) : "—";

  // Payloads carry the asset's name as it was when the alert was raised
  // (the Latin one); show the name the owner reads, as it is now.
  const assetIds = [
    ...new Set([
      ...alerts.map((alert) => (alert.payload as AlertPayload).assetId).filter(Boolean),
      ...groups.map((group) => group.assetId).filter(Boolean),
    ]),
  ] as string[];
  const alertAssets = assetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds }, operatorId: operator.id },
        select: { id: true, name: true, nameKa: true, category: true, _count: { select: { contracts: { where: LIVE_CONTRACT } } } },
      })
    : [];
  const assetNames = new Map(
    alertAssets.map((asset) => [asset.id, locale === "ka" && asset.nameKa ? asset.nameKa : asset.name]),
  );
  // An alert about a car or a flat leads to its service desk (the tab the
  // alert is about); assets without a desk have none.
  const deskOf = new Map(
    alertAssets.map((asset) => [asset.id, rentalDesk(asset.category, asset._count.contracts)]),
  );
  const assetLabelOf = (payload: AlertPayload) =>
    (payload.assetId && assetNames.get(payload.assetId)) || payload.assetName;
  const deskFor = (assetId: string) => deskOf.get(assetId) ?? null;

  // Stored days ("2026-10-27") written out like the calendar: "27 ოქტ".
  const dayFormat = tbilisiFormat(locale, { day: "numeric", month: "short" });
  const day = (key: string | undefined) =>
    key && /^\d{4}-\d{2}-\d{2}$/.test(key) ? dayFormat.format(new Date(`${key}T00:00:00Z`)) : (key ?? "—");
  const span = (start: string | undefined, end: string | undefined) => `${day(start)} – ${day(end)}`;
  const monthLabel = (key: string | undefined) =>
    key && /^\d{4}-\d{2}$/.test(key)
      ? tbilisiFormat(locale, { month: "long", year: "numeric" }).format(new Date(`${key}-01T00:00:00Z`))
      : (key ?? "");

  // Late-rent figures are read from the contract as it stands today — the
  // same statusFor, with the asset's pricing, as the dashboard, the rental
  // page and the WhatsApp text — not from the snapshot taken the day the
  // alert was raised, which would freeze at "1/3 days, 90 GEL".
  const now = new Date();
  const today = startOfTodayTbilisi(now);
  const fmtStamp = tbilisiFormat(locale, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  const contractIds = [
    ...new Set(
      alerts
        .filter((alert) => CONTRACT_ALERTS.includes(alert.type))
        .map((alert) => (alert.payload as AlertPayload).contractId)
        .filter(Boolean),
    ),
  ] as string[];
  const contracts = contractIds.length
    ? await prisma.rentalContract.findMany({
        where: { id: { in: contractIds }, asset: { operatorId: operator.id }, ...LIVE_CONTRACT },
        include: {
          asset: { select: { dailyRate: true, weekendPct: true, holidayPct: true } },
        },
      })
    : [];
  const live = new Map<string, ScheduleStatus | null>(
    contracts.map((contract) => [
      contract.id,
      contract.paidThrough ? statusFor(contract, today, contract.asset) : null,
    ]),
  );
  const currencyOf = new Map(contracts.map((contract) => [contract.id, contract.currency]));
  // Amounts owed are quoted rounded up to the tetri, as in the WhatsApp text.
  const owed = formatDueMoney;
  const owes = (status: ScheduleStatus | null | undefined) =>
    status != null && status.periodsOwed > 0 && status.amountDue > 0;

  // Where each of two overlapping stays comes from.
  const sourceLabel = (stay: OverlapStay) => {
    switch (stay.source) {
      case "airbnb":
        return "Airbnb";
      case "booking":
        return "Booking.com";
      case "direct":
        return t(locale, "source_direct");
      case "manual":
        return t(locale, "source_manual");
      case "lease":
        return t(locale, "overlap_src_lease");
      case "contract":
        return stay.tenantName || t(locale, "overlap_src_contract");
      default:
        return stay.source ?? "—";
    }
  };

  // Inside a group the place is already named in its heading.
  const detail = (type: string, payload: AlertPayload, currency: string, named = true): ReactNode => {
    const assetLabel = (p: AlertPayload) => (named ? assetLabelOf(p) : null);
    switch (type) {
      case "vacancy_gap":
        return payload.openEnd
          ? `${day(payload.start)} – … · ${payload.nights}+ ${t(locale, "nights_short")} · ${t(locale, "gap_open_end")}`
          : `${span(payload.start, payload.end)} · ${payload.nights} ${t(locale, "nights_short")}`;
      case "overlap":
        return [
          assetLabel(payload),
          `${span(payload.start, payload.end)} · ${payload.nights} ${t(locale, "nights_short")}`,
          (payload.stays ?? [])
            .map((stay) => `${sourceLabel(stay)} ${span(stay.start, stay.end)}`)
            .join(" + "),
        ]
          .filter(Boolean)
          .join(" · ");
      case "lease_expiry":
        return `${payload.tenantName ?? "—"} · ${day(payload.endDate)} · ${payload.daysLeft} ${t(locale, "days_left")}`;
      case "underpriced":
        // A line icon, not a text "→" (that alone pulls in a symbol font file).
        return (
          <>
            {formatMoney(payload.baseNightlyRate, currency)}{" "}
            <IconArrowRight size={12} className="inline-arrow" />{" "}
            {formatMoney(payload.suggestedRate, currency)} · {t(locale, "alert_market_adr")}{" "}
            {formatMoney(payload.benchmarkAdr, currency)} ({monthLabel(payload.month)})
          </>
        );
      case "contract_expiry":
        return [
          assetLabel(payload),
          payload.tenantName ?? "—",
          payload.paymentAmount != null && payload.paymentPeriod
            ? `${formatMoney(payload.paymentAmount, currency, "auto")} / ${t(locale, periodWordKey(payload.paymentPeriod))}`
            : formatMoney(payload.monthlyRent, currency, "auto"),
          day(payload.endDate),
          `${payload.daysLeft} ${t(locale, "days_left")}`,
        ]
          .filter(Boolean)
          .join(" · ");
      case "contract_ended": {
        const status = payload.contractId ? live.get(payload.contractId) : null;
        return [
          assetLabel(payload),
          payload.tenantName ?? "—",
          `${t(locale, "cstatus_ended")}: ${day(payload.endDate)}`,
          // Rent still owed when it ended stays in sight.
          owes(status)
            ? `${t(locale, "alert_unpaid")}: ${owed(status!.amountDue, currencyOf.get(payload.contractId!) ?? currency)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
      }
      case "rent_overdue":
      case "repossession_right": {
        const status =
          !done && payload.contractId ? live.get(payload.contractId) : undefined;
        const unit = payload.currency ?? currency;
        if (status) {
          return [
            assetLabel(payload),
            payload.plate,
            payload.tenantName ?? "—",
            owes(status)
              ? owed(status.amountDue, unit)
              : t(locale, `pstate_${status.state}` as StringKey),
            `${t(locale, "pay_next_due")}: ${day(dayKey(status.nextDueDate))}`,
            `${t(locale, "pay_days_overdue")}: ${status.daysOverdue}/${status.graceDays}`,
          ]
            .filter(Boolean)
            .join(" · ");
        }
        return [
          assetLabel(payload),
          payload.plate,
          payload.tenantName ?? "—",
          payload.amountDue != null ? owed(payload.amountDue, unit) : null,
          `${t(locale, "pay_next_due")}: ${day(payload.dueDate)}`,
          `${t(locale, "pay_days_overdue")}: ${payload.daysOverdue}/${payload.graceDays}`,
          !done && payload.contractId && !live.has(payload.contractId)
            ? t(locale, "withdraw_contract_deleted")
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
      }
      case "tracker_silent": {
        const last = payload.lastPingAt ? new Date(payload.lastPingAt) : null;
        const span = last ? silenceSpan(last, now) : null;
        return [
          assetLabel(payload),
          payload.plate,
          last ? `${t(locale, "gps_last_ping")}: ${fmtStamp.format(last)}` : null,
          span
            ? t(locale, "gps_silent").replace(
                "{span}",
                t(locale, `dur_${span.unit}` as StringKey).replace("{n}", String(span.n)),
              )
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
      }
      case "geofence_breach":
        return [
          assetLabel(payload),
          payload.plate,
          payload.fenceName,
          payload.driverName,
          payload.lat != null && payload.lng != null
            ? `${payload.lat.toFixed(4)}, ${payload.lng.toFixed(4)}`
            : null,
          payload.distanceKm != null ? `${formatNumber(Math.round(payload.distanceKm * 10) / 10, "auto")} ${t(locale, "unit_km")}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
      default:
        return "";
    }
  };

  type Row = (typeof alerts)[number];
  // Late rent on a flat is not a vehicle to take back; two contracts on one
  // asset are not two stays on a unit.
  const variantOf = (alert: Row) => {
    const payload = alert.payload as AlertPayload;
    const category = categoryOf(payload);
    if (alert.type === "repossession_right" && category != null && templateFamily(category) === "property") {
      return "property" as const;
    }
    if (alert.type === "overlap" && !alert.unit) return "contracts" as const;
    return null;
  };
  const titleOf = (alert: Row): string => {
    const variant = variantOf(alert);
    return t(
      locale,
      variant === "property"
        ? "alert_repossession_right_property"
        : variant === "contracts"
          ? "alert_overlap_contract"
          : (`alert_${alert.type}` as StringKey),
    );
  };
  const actionKeyOf = (alert: Row): StringKey => {
    const variant = variantOf(alert);
    return variant === "property"
      ? "action_repossession_right_property"
      : variant === "contracts"
        ? "action_overlap_contract"
        : (`action_${alert.type}` as StringKey);
  };
  // A finished contract that still owes rent is rent, not advice
  // (lib/alerts/owing.ts): warn-coloured and its group open.
  const owingEnding = (alert: Row) => {
    const payload = alert.payload as AlertPayload;
    return alert.type === "contract_ended" && payload.contractId != null && owes(live.get(payload.contractId));
  };
  const severityOf = (alert: Row) => endedAlertSeverity(alert.type, owingEnding(alert));
  // The place's name as the owner reads it: the unit, else the asset.
  const placeName = (alert: Row, assetId?: string | null): string | null => {
    if (alert.unit) return displayName(alert.unit);
    const id = assetId ?? (alert.payload as AlertPayload).assetId;
    return (id && assetNames.get(id)) || assetLabelOf(alert.payload as AlertPayload) || null;
  };
  // Where an alert leads — null when it names no place (it would only
  // link back to this page).
  const hrefOf = (alert: Row): string | null => {
    const href = alertHref(alert, deskFor);
    return href === "/alerts" ? null : href;
  };
  // What a group's link opens, named for where it goes.
  const openLabel = (href: string): StringKey =>
    href.startsWith("/calendar")
      ? "alerts_open_calendar"
      : href.startsWith("/pricing")
        ? "alerts_open_pricing"
        : href.includes("/rental")
          ? "alerts_open_desk"
          : "alerts_open_asset";
  // The soonest real day a group is about (a month of advice is no day).
  const shownDay = (list: Row[]): string | null =>
    list
      .map((alert) => {
        const p = alert.payload as AlertPayload;
        return p.start ?? p.dueDate ?? p.endDate ?? null;
      })
      .filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
      .sort()[0] ?? null;
  // "3 free windows (14 nights)", "Double booking", "Rent late (2)".
  const kindPhrase = (kind: { type: string; alerts: Row[] }): string => {
    const n = kind.alerts.length;
    const title = titleOf(kind.alerts[0]);
    if (n === 1) return title;
    if (kind.type === "vacancy_gap") {
      const nights = kind.alerts.reduce((sum, alert) => sum + ((alert.payload as AlertPayload).nights ?? 0), 0);
      return t(locale, "alerts_n_vacancy_gap").replace("{n}", String(n)).replace("{nights}", String(nights));
    }
    return `${title} (${n})`;
  };

  // Every free window on the list, and how many places have one.
  const vacancyIds = alerts.filter((alert) => alert.type === "vacancy_gap").map((alert) => alert.id);
  const vacancyGroups = groups.filter((group) => group.kinds.some((kind) => kind.type === "vacancy_gap")).length;
  // Places whose only news is free windows are one card, not one card each
  // (eleven rooms with gaps used to be eleven of twelve cards): a line per
  // place with its nearest window, all of them on the calendar.
  const windowsOnly = groups.filter(
    (group) => group.kinds.length === 1 && group.kinds[0].type === "vacancy_gap",
  );
  const foldWindows = windowsOnly.length >= 2;
  const mainGroups = foldWindows ? groups.filter((group) => !windowsOnly.includes(group)) : groups;

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" data-tour="alerts">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "alerts_title")}</h1>
        {/* The demo is read-only: no button it could not use. */}
        {!done && !outbox && !operator.isDemo && (
          <form action={runAlertScan}>
            <button type="submit" className="btn-secondary">
              {t(locale, "alerts_scan")}
            </button>
          </form>
        )}
      </div>

      {!done && !outbox && (
        // When the platform last looked by itself — so "all clear" is never
        // a guess, and a stopped schedule is noticed.
        <p
          className="alerts-run"
          data-state={scanned != null ? "ok" : !lastRun ? "never" : !lastRun.ok || lastRun.late ? "warn" : "ok"}
        >
          {scanned != null ? (
            t(locale, "alerts_scanned_now").replace("{n}", String(scanned))
          ) : operator.isDemo && !lastRun ? (
            t(locale, "alerts_demo_run")
          ) : lastRun ? (
            <>
              {t(locale, "alerts_last_run").replace("{at}", fmtStamp.format(lastRun.at))}
              {!lastRun.ok
                ? ` — ${t(locale, "alerts_last_run_failed")}`
                : lastRun.late
                  ? ` — ${t(locale, "alerts_last_run_late")}`
                  : `. ${t(locale, "alerts_schedule_hint")}`}
            </>
          ) : (
            t(locale, "alerts_last_run_never")
          )}
        </p>
      )}

      <div className="mb-5 flex flex-wrap gap-1.5">
        {(
          [
            { key: "open", href: "/alerts", label: t(locale, "alerts_active_tab"), on: !done && !outbox },
            {
              key: "outbox",
              href: "/alerts?tab=outbox",
              label:
                outboxNow.waiting.length > 0
                  ? `${t(locale, "alerts_outbox_tab")} (${outboxNow.waiting.length})`
                  : t(locale, "alerts_outbox_tab"),
              on: outbox,
            },
            { key: "done", href: "/alerts?view=done", label: t(locale, "alerts_done_tab"), on: done },
          ] as const
        ).map((chip) => (
          <Link
            key={chip.key}
            href={chip.href}
            className={`btn-chip ${chip.on ? "btn-chip--active" : ""}`}
            // The current view of this page — the top nav already marks
            // the page itself ("page" once per page).
            aria-current={chip.on ? "true" : undefined}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {!done && !outbox && (
        // By kind: only rent, only GPS, only the calendar, only contracts.
        <nav className="mb-4 flex flex-wrap gap-1.5" aria-label={t(locale, "alerts_filter_label")}>
          {[{ key: null, label: "alerts_filter_all" as StringKey }, ...ALERT_FILTERS].map((filter) => {
            const on = (typeFilter?.key ?? null) === filter.key;
            return (
              <Link
                key={filter.key ?? "all"}
                href={filter.key ? `/alerts?type=${filter.key}` : "/alerts"}
                className={`btn-chip ${on ? "btn-chip--active" : ""}`}
                aria-current={on ? "true" : undefined}
              >
                {t(locale, filter.label)}
              </Link>
            );
          })}
        </nav>
      )}

      {outbox ? (
        <section style={{ marginTop: 0 }}>
          <p className="section-hint" style={{ maxWidth: 640 }}>
            {t(locale, autoSend ? "alerts_outbox_intro_auto" : "alerts_outbox_intro")}
          </p>
          {outboxNow.waiting.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "alerts_outbox_empty")}</p>
          ) : (
            <OutboxList locale={locale} items={outboxNow.waiting} autoSend={autoSend} />
          )}
          {outboxNow.hiddenOwner > 0 && (
            <p className="field-hint" style={{ marginTop: 10 }}>
              {t(locale, "alerts_outbox_owner_hidden").replace("{n}", String(outboxNow.hiddenOwner))}
            </p>
          )}
          {outboxNow.waiting.some((item) => item.status === "failed") && (
            <form action={retryOutbox} style={{ marginTop: 12 }}>
              <button type="submit" className="btn-secondary">
                {t(locale, "outbox_retry")}
              </button>
            </form>
          )}
          {outboxNow.recent.length > 0 && (
            <details className="desk-fold">
              <summary>
                {t(locale, "alerts_outbox_recent").replace("{n}", String(outboxNow.recent.length))}
              </summary>
              <OutboxList locale={locale} items={outboxNow.recent.slice(0, 40)} autoSend={autoSend} />
            </details>
          )}
        </section>
      ) : alerts.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          {t(locale, done ? "alerts_done_empty" : "alerts_empty")}
        </p>
      ) : done ? (
        <>
          {alerts.map((alert) => {
            const payload = alert.payload as AlertPayload;
            return (
              <div key={alert.id} className={alertCardClass("muted")}>
                <div>
                  <div className="alert-card__title">
                    <AlertTypeIcon type={alert.type} />
                    {titleOf(alert)}
                    {placeName(alert) ? ` — ${placeName(alert)}` : ""}
                  </div>
                  <div className="alert-card__detail">
                    {detail(alert.type, payload, alert.unit?.currency ?? "GEL")}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={badgeClass(alert.status === "dismissed" ? "muted" : "good")}>
                    {t(locale, alert.status === "dismissed" ? "alerts_hidden_badge" : "alert_done_at")}
                    {alert.resolvedAt
                      ? ` · ${tbilisiFormat(locale, { day: "numeric", month: "short" }).format(alert.resolvedAt)}`
                      : ""}
                  </span>
                  {/* Hidden by mistake: one tap brings it back. */}
                  {alert.status === "dismissed" && (
                    <form action={reopenAlerts}>
                      <input type="hidden" name="alertId" value={alert.id} />
                      <button type="submit" className="btn-chip">
                        {t(locale, "alerts_reopen")}
                      </button>
                    </form>
                  )}
                  {payload.autoResolved &&
                    WITHDRAW_REASONS.includes(payload.autoResolved as never) && (
                      <span className="cell-sub">
                        {t(locale, "alert_auto")}: {t(locale, `withdraw_${payload.autoResolved}` as StringKey)}
                      </span>
                    )}
                </div>
              </div>
            );
          })}
        </>
      ) : (
        // One group per flat, room or car, the most severe first; inside,
        // one block per kind of alert with its advice said once.
        <div className="alert-groups">
          {openTotal != null && (
            <p className="field-hint">
              {t(locale, "alerts_limited")
                .replace("{shown}", String(alerts.length))
                .replace("{total}", String(openTotal))}
            </p>
          )}
          {vacancyGroups >= 2 && (
            // Free windows of every place hidden with one tap.
            <form action={setAlertStatus} className="alert-groups__bulk">
              {vacancyIds.map((id) => (
                <input key={id} type="hidden" name="alertId" value={id} />
              ))}
              <input type="hidden" name="status" value="dismissed" />
              <button type="submit" className="btn-chip" title={t(locale, "alert_dismiss_hint")}>
                {t(locale, "alerts_hide_windows").replace("{n}", String(vacancyIds.length))}
              </button>
            </form>
          )}
          {mainGroups.map((group) => {
            const first = group.alerts[0];
            const sev = severityOf(first);
            const name = group.unitId || group.assetId ? placeName(first, group.assetId) : null;
            // Something to do today (urgent, late rent) is open; advice —
            // free windows, prices, contracts ending — waits folded.
            const open =
              group.key === focusGroup ||
              groups.length <= 3 ||
              group.rank <= alertRank("rent_overdue") ||
              group.alerts.some(owingEnding);
            const summary = group.kinds.map((kind) => kindPhrase(kind)).join(" · ");
            const waitingHere = group.assetId ? waitingByAsset.get(group.assetId) ?? 0 : 0;
            const desk = group.assetId ? deskFor(group.assetId) : null;
            const groupHref = hrefOf(first);
            // "Hide all" only where everything is advice: an urgent alert or
            // rent is closed one by one, on purpose.
            const hideable = group.alerts.every(
              (alert) => ADVICE_TYPES.includes(alert.type) && !owingEnding(alert),
            );
            return (
              <details
                key={group.key}
                id={`g-${group.key}`}
                className={`alert-group alert-group--${sev}`}
                open={open}
              >
                <summary className="alert-group__head">
                  <AlertTypeIcon type={first.type} />
                  <span className="alert-group__title">
                    <b>{name ?? titleOf(first)}</b>
                    <span>{name ? summary : detail(first.type, first.payload as AlertPayload, first.unit?.currency ?? "GEL")}</span>
                  </span>
                  {shownDay(group.alerts) && <span className="alert-group__day">{day(shownDay(group.alerts)!)}</span>}
                  <span className="alert-group__chev" aria-hidden>
                    <IconChevronDown size={16} />
                  </span>
                </summary>
                <div className="alert-group__body">
                  {group.kinds.map((kind) => (
                    <div key={kind.type} className="alert-kind">
                      {name && group.kinds.length > 1 && (
                        <div className="alert-kind__title">
                          {titleOf(kind.alerts[0])}
                          {kind.alerts.length > 1 && <span className="today-count">{kind.alerts.length}</span>}
                        </div>
                      )}
                      <p className="alert-kind__action">
                        <b>{t(locale, "alert_action")}:</b> {t(locale, actionKeyOf(kind.alerts[0]))}
                      </p>
                      <ul className="alert-rows">
                        {kind.alerts.map((alert) => {
                          const href = hrefOf(alert);
                          const text =
                            detail(alert.type, alert.payload as AlertPayload, alert.unit?.currency ?? "GEL", !name) ||
                            (href ? t(locale, "alert_open_desk") : "");
                          return (
                          <li key={alert.id} className="alert-row">
                            {href ? (
                              <Link href={href} className="alert-row__detail link">
                                {text}
                              </Link>
                            ) : (
                              <span className="alert-row__detail">{text}</span>
                            )}
                            <span className="alert-row__acts">
                              <form action={setAlertStatus}>
                                <input type="hidden" name="alertId" value={alert.id} />
                                <input type="hidden" name="group" value={group.key} />
                                <input type="hidden" name="status" value="resolved" />
                                <button type="submit" className="btn-chip" title={t(locale, "alert_resolve_hint")}>
                                  {t(locale, "alert_resolve")}
                                </button>
                              </form>
                              <form action={setAlertStatus}>
                                <input type="hidden" name="alertId" value={alert.id} />
                                <input type="hidden" name="group" value={group.key} />
                                <input type="hidden" name="status" value="dismissed" />
                                <button type="submit" className="btn-chip" title={t(locale, "alert_dismiss_hint")}>
                                  {t(locale, "alert_dismiss")}
                                </button>
                              </form>
                            </span>
                          </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                  <div className="alert-group__foot">
                    {groupHref && (
                      <Link href={groupHref} className="link icon-text">
                        {t(locale, openLabel(groupHref))} <IconArrowRight size={14} />
                      </Link>
                    )}
                    {waitingHere > 0 && desk && (
                      <Link href={deskHref(group.assetId!, desk, "messages")} className="link">
                        {t(locale, "alert_messages_waiting").replace("{n}", String(waitingHere))}
                      </Link>
                    )}
                    {group.alerts.length > 1 && hideable && (
                      <form action={setAlertStatus} className="alert-group__all">
                        {group.alerts.map((alert) => (
                          <input key={alert.id} type="hidden" name="alertId" value={alert.id} />
                        ))}
                        <input type="hidden" name="group" value={group.key} />
                        <input type="hidden" name="status" value="dismissed" />
                        <button type="submit" className="btn-chip" title={t(locale, "alert_dismiss_hint")}>
                          {t(locale, "alerts_hide_group").replace("{n}", String(group.alerts.length))}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
          {foldWindows && (
            <details className="alert-group alert-group--info" id="g-windows" open={focusGroup === "windows"}>
              <summary className="alert-group__head">
                <AlertTypeIcon type="vacancy_gap" />
                <span className="alert-group__title">
                  <b>{t(locale, "tips_windows_title")}</b>
                  <span>
                    {t(locale, "alerts_windows_summary")
                      .replace("{places}", String(windowsOnly.length))
                      .replace("{n}", String(windowsOnly.reduce((sum, group) => sum + group.alerts.length, 0)))}
                  </span>
                </span>
                <span className="alert-group__chev" aria-hidden>
                  <IconChevronDown size={16} />
                </span>
              </summary>
              <div className="alert-group__body">
                <p className="alert-kind__action">
                  <b>{t(locale, "alert_action")}:</b> {t(locale, "action_vacancy_gap")}
                </p>
                <ul className="alert-rows">
                  {windowsOnly.map((group) => {
                    const first = group.alerts[0];
                    const href = hrefOf(first);
                    const name = placeName(first, group.assetId) ?? titleOf(first);
                    const text = `${name} · ${detail(first.type, first.payload as AlertPayload, first.unit?.currency ?? "GEL", true)}${
                      group.alerts.length > 1 ? ` · ${t(locale, "tips_more_windows").replace("{n}", String(group.alerts.length - 1))}` : ""
                    }`;
                    return (
                      <li key={group.key} className="alert-row">
                        {href ? (
                          <Link href={href} className="alert-row__detail link">
                            {text}
                          </Link>
                        ) : (
                          <span className="alert-row__detail">{text}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="alert-group__foot">
                  <Link href="/calendar" className="link icon-text">
                    {t(locale, "alerts_open_calendar")} <IconArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {justClosed > 0 && (
        // What was just closed, with its way back.
        <div className="alerts-toast" role="status">
          <span>{t(locale, "alerts_closed").replace("{n}", String(justClosed))}</span>
          <form action={reopenAlerts}>
            {closedIds.map((id) => (
              <input key={id} type="hidden" name="alertId" value={id} />
            ))}
            {focusGroup && <input type="hidden" name="group" value={focusGroup} />}
            <button type="submit" className="btn-chip">
              {t(locale, "alerts_undo")}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
