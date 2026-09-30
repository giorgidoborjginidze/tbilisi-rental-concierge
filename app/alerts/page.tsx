import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { dismissVacancyAlerts, runAlertScan, setAlertStatus } from "@/lib/alerts/actions";
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
import { rankAlerts } from "@/lib/alerts/rank";
import { firstParam, type QueryValue } from "@/lib/params";
import { titled } from "@/lib/i18n/metadata";
import { alertCardClass, badgeClass, endedAlertSeverity } from "@/lib/ui/tone";
import { AlertTypeIcon } from "../alert-icon";
import { IconArrowRight } from "../icons";
import OutboxList, { type OutboxItem } from "../outbox-list";
import { alertDeskTab, deskHref, rentalDesk } from "@/lib/rentals/desk";
import { autoSendFor } from "@/lib/notify/whatsapp";
import { outboxView } from "@/lib/notify/outbox-view";
import { stalePaymentMessage } from "@/lib/rentals/settle";
import { retryOutbox } from "@/lib/rentals/actions";

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
  searchParams: Promise<{ view?: QueryValue; tab?: QueryValue }>;
}) {
  const operator = await requireOperator();

  const query = await searchParams;
  const view = firstParam(query.view);
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
  // Free windows are listed on the calendar (with a suggested price); the
  // open view sums them up in one card.
  const gapAlerts = done ? [] : alerts.filter((alert) => alert.type === "vacancy_gap");
  const listed = done ? alerts : alerts.filter((alert) => alert.type !== "vacancy_gap");
  const lastRun = done ? null : await lastRunFor(operator.id);

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
          select: { id: true, name: true, nameKa: true, category: true, _count: { select: { contracts: true } } },
        })
      : [],
    messageContractIds.length
      ? prisma.rentalContract.findMany({
          where: { id: { in: messageContractIds }, asset: { operatorId: operator.id } },
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
    ...new Set(alerts.map((alert) => (alert.payload as AlertPayload).assetId).filter(Boolean)),
  ] as string[];
  const alertAssets = assetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds }, operatorId: operator.id },
        select: { id: true, name: true, nameKa: true, category: true, _count: { select: { contracts: true } } },
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
  const assetLabel = (payload: AlertPayload) =>
    (payload.assetId && assetNames.get(payload.assetId)) || payload.assetName;

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
        where: { id: { in: contractIds }, asset: { operatorId: operator.id } },
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

  const detail = (type: string, payload: AlertPayload, currency: string) => {
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
        return `${assetLabel(payload)} · ${payload.tenantName ?? "—"} · ${
          payload.paymentAmount != null && payload.paymentPeriod
            ? `${formatMoney(payload.paymentAmount, currency, "auto")} / ${t(locale, periodWordKey(payload.paymentPeriod))}`
            : formatMoney(payload.monthlyRent, currency, "auto")
        } · ${day(payload.endDate)} · ${payload.daysLeft} ${t(locale, "days_left")}`;
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
      ) : (
        <>
        {listed.map((alert) => {
          const payload = alert.payload as AlertPayload;
          const currency = alert.unit?.currency ?? "GEL";
          // Late rent on a flat is not a vehicle to take back.
          const category = categoryOf(payload);
          const property =
            alert.type === "repossession_right" &&
            category != null &&
            templateFamily(category) === "property";
          // Two contracts on one asset, rather than two stays on a unit.
          const contracts = alert.type === "overlap" && !alert.unit;
          const titleKey: StringKey = property
            ? "alert_repossession_right_property"
            : contracts
              ? "alert_overlap_contract"
              : (`alert_${alert.type}` as StringKey);
          const desk = payload.assetId ? deskOf.get(payload.assetId) ?? null : null;
          const deskLink =
            desk && payload.assetId ? deskHref(payload.assetId, desk, alertDeskTab(alert.type)) : null;
          const waitingHere = payload.assetId ? waitingByAsset.get(payload.assetId) ?? 0 : 0;
          const actionKey: StringKey = property
            ? "action_repossession_right_property"
            : contracts
              ? "action_overlap_contract"
              : (`action_${alert.type}` as StringKey);
          return (
            <div
              key={alert.id}
              className={alertCardClass(
                done
                  ? "muted"
                  : endedAlertSeverity(
                      alert.type,
                      alert.type === "contract_ended" &&
                        payload.contractId != null &&
                        owes(live.get(payload.contractId)),
                    ),
              )}
            >
              <div>
                <div className="alert-card__title">
                  <AlertTypeIcon type={alert.type} />
                  {t(locale, titleKey)}
                  {alert.unit && (
                    <>
                      {" "}
                      <Link href={`/calendar?unit=${alert.unit.id}`} className="link">
                        {displayName(alert.unit)}
                      </Link>
                    </>
                  )}
                </div>
                {!done && deskLink && (
                  <div className="alert-card__links">
                    <Link href={deskLink} className="link icon-text">
                      {assetLabel(payload) ?? t(locale, "alert_open_desk")}{" "}
                      <IconArrowRight size={14} />
                    </Link>
                    {waitingHere > 0 && (
                      <Link href={deskHref(payload.assetId!, desk!, "messages")} className="link">
                        {t(locale, "alert_messages_waiting").replace("{n}", String(waitingHere))}
                      </Link>
                    )}
                  </div>
                )}
                <div className="alert-card__detail">
                  {detail(alert.type, payload, currency)}
                </div>
                <div className="alert-card__action">
                  <b>{t(locale, "alert_action")}:</b> {t(locale, actionKey)}
                </div>
              </div>
              {done ? (
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
              ) : (
                <div className="flex gap-2">
                  <form action={setAlertStatus}>
                    <input type="hidden" name="alertId" value={alert.id} />
                    <input type="hidden" name="status" value="resolved" />
                    <button type="submit" className="btn-chip">
                      {t(locale, "alert_resolve")}
                    </button>
                  </form>
                  <form action={setAlertStatus}>
                    <input type="hidden" name="alertId" value={alert.id} />
                    <input type="hidden" name="status" value="dismissed" />
                    <button type="submit" className="btn-chip">
                      {t(locale, "alert_dismiss")}
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
        {/* Free windows live on the calendar, with a suggested price: here
            they are one card, not one card per window. */}
        {gapAlerts.length > 0 && (
          <div className={alertCardClass("info")}>
            <div>
              <div className="alert-card__title">
                <AlertTypeIcon type="vacancy_gap" />
                {t(locale, "alerts_gaps_title").replace("{n}", String(gapAlerts.length))}
              </div>
              <div className="alert-card__detail">
                {t(locale, "alerts_gaps_detail").replace(
                  "{units}",
                  String(new Set(gapAlerts.map((alert) => alert.unitId)).size),
                )}
              </div>
              <div className="alert-card__links">
                <Link href="/calendar" className="link icon-text">
                  {t(locale, "alerts_gaps_open")} <IconArrowRight size={14} />
                </Link>
              </div>
            </div>
            <form action={dismissVacancyAlerts}>
              <button type="submit" className="btn-chip">
                {t(locale, "alerts_gaps_dismiss")}
              </button>
            </form>
          </div>
        )}
        </>
      )}
    </main>
  );
}
