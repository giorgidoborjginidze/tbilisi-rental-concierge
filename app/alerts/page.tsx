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
import { formatDueMoney, formatMoney } from "@/lib/format";
import { silenceSpan } from "@/lib/geo/silence";
import { WITHDRAW_REASONS } from "@/lib/rentals/settle";
import type { ScheduleStatus } from "@/lib/rentals/schedule";
import { dayKey, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import { lastRunFor } from "@/lib/automation/run";
import { alertRank, rankAlerts } from "@/lib/alerts/rank";
import { firstParam, type QueryValue } from "@/lib/params";
import { titled } from "@/lib/i18n/metadata";
import { alertCardClass, badgeClass, endedAlertSeverity } from "@/lib/ui/tone";
import { AlertTypeIcon } from "../alert-icon";
import { IconArrowRight, IconChevronDown } from "../icons";
import OutboxList, { type OutboxItem } from "../outbox-list";
import { deskHref, rentalDesk } from "@/lib/rentals/desk";
import { autoSendFor } from "@/lib/notify/whatsapp";
import { outboxView } from "@/lib/notify/outbox-view";
import { stalePaymentMessage } from "@/lib/rentals/settle";
import { retryOutbox } from "@/lib/rentals/actions";
import { LIVE_CONTRACT } from "@/lib/rentals/live";

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

/** Alert types whose figures are read live from their contract. */
const CONTRACT_ALERTS = ["rent_overdue", "repossession_right", "contract_ended"];

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: QueryValue; tab?: QueryValue; closed?: QueryValue; g?: QueryValue }>;
}) {
  const operator = await requireOperator();

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
  const found = await prisma.alert.findMany({
    where: { operatorId: operator.id, status: done ? "resolved" : "open" },
    include: { unit: { select: { id: true, name: true, nameKa: true, currency: true } } },
    orderBy: done ? { resolvedAt: "desc" } : { createdAt: "desc" },
    take: done ? 50 : undefined,
  });
  // Open alerts: what costs money or the car today comes first.
  const alerts = done ? found : rankAlerts(found);
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
  const messageContractIds = [
    ...new Set(messageRows.map((message) => message.contractId).filter(Boolean)),
  ] as string[];
  const [messageAssets, messageContracts] = await Promise.all([
    messageAssetIds.length
      ? prisma.asset.findMany({
          where: { id: { in: messageAssetIds }, operatorId: operator.id },
          select: { id: true, name: true, nameKa: true, category: true, _count: { select: { contracts: { where: LIVE_CONTRACT } } } },
        })
      : [],
    messageContractIds.length
      ? prisma.rentalContract.findMany({
          where: { id: { in: messageContractIds }, asset: { operatorId: operator.id }, ...LIVE_CONTRACT },
        })
      : [],
  ]);
  const messageAssetBy = new Map(messageAssets.map((asset) => [asset.id, asset]));
  const messageContractBy = new Map(messageContracts.map((contract) => [contract.id, contract]));
  const outboxItems: OutboxItem[] = messageRows.map((message) => {
    const asset = message.assetId ? messageAssetBy.get(message.assetId) : undefined;
    const desk = asset ? rentalDesk(asset.category, asset._count.contracts) : null;
    return {
      ...message,
      stale:
        (message.status === "queued" || message.status === "failed") && message.contractId
          ? stalePaymentMessage(message, messageContractBy.get(message.contractId) ?? null, today0)
          : null,
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
  const detail = (type: string, payload: AlertPayload, currency: string, named = true) => {
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
        return `${formatMoney(payload.baseNightlyRate, currency)} → ${formatMoney(payload.suggestedRate, currency)} · ${t(locale, "alert_market_adr")} ${formatMoney(payload.benchmarkAdr, currency)} (${monthLabel(payload.month)})`;
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
          payload.distanceKm != null ? `${payload.distanceKm} km` : null,
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
  const severityOf = (alert: Row) => {
    const payload = alert.payload as AlertPayload;
    return endedAlertSeverity(
      alert.type,
      alert.type === "contract_ended" && payload.contractId != null && owes(live.get(payload.contractId)),
    );
  };
  // The place's name as the owner reads it: the unit, else the asset.
  const placeName = (alert: Row, assetId?: string | null): string | null => {
    if (alert.unit) return displayName(alert.unit);
    const id = assetId ?? (alert.payload as AlertPayload).assetId;
    return (id && assetNames.get(id)) || assetLabelOf(alert.payload as AlertPayload) || null;
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

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" data-tour="alerts">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "alerts_title")}</h1>
        {!done && !outbox && (
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
          data-state={!lastRun ? "never" : !lastRun.ok || lastRun.late ? "warn" : "ok"}
        >
          {lastRun ? (
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
            aria-current={chip.on ? "page" : undefined}
          >
            {chip.label}
          </Link>
        ))}
      </div>

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
                  <span className={badgeClass("good")}>
                    {t(locale, "alert_done_at")}
                    {alert.resolvedAt
                      ? ` · ${tbilisiFormat(locale, { day: "numeric", month: "short" }).format(alert.resolvedAt)}`
                      : ""}
                  </span>
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
          {groups.map((group) => {
            const first = group.alerts[0];
            const sev = severityOf(first);
            const name = group.unitId || group.assetId ? placeName(first, group.assetId) : null;
            // Something to do today (urgent, late rent) is open; advice —
            // free windows, prices, contracts ending — waits folded.
            const open =
              group.key === focusGroup || groups.length <= 3 || group.rank <= alertRank("rent_overdue");
            const summary = group.kinds.map((kind) => kindPhrase(kind)).join(" · ");
            const waitingHere = group.assetId ? waitingByAsset.get(group.assetId) ?? 0 : 0;
            const desk = group.assetId ? deskFor(group.assetId) : null;
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
                        {kind.alerts.map((alert) => (
                          <li key={alert.id} className="alert-row">
                            <Link href={alertHref(alert, deskFor)} className="alert-row__detail link">
                              {detail(alert.type, alert.payload as AlertPayload, alert.unit?.currency ?? "GEL", !name) ||
                                t(locale, "alert_open_desk")}
                            </Link>
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
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="alert-group__foot">
                    <Link href={alertHref(first, deskFor)} className="link icon-text">
                      {t(locale, openLabel(alertHref(first, deskFor)))} <IconArrowRight size={14} />
                    </Link>
                    {waitingHere > 0 && desk && (
                      <Link href={deskHref(group.assetId!, desk, "messages")} className="link">
                        {t(locale, "alert_messages_waiting").replace("{n}", String(waitingHere))}
                      </Link>
                    )}
                    {group.alerts.length > 1 && (
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
