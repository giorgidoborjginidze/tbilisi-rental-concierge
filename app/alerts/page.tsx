import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { runAlertScan, setAlertStatus } from "@/lib/alerts/actions";
import { alertCategories } from "@/lib/alerts/category";
import { templateFamily } from "@/lib/notify/templates";
import { formatAmount, periodWordKey } from "@/lib/rentals/display";
import { statusFor } from "@/lib/rentals/terms";
import { formatDue } from "@/lib/rentals/money";
import { silenceSpan } from "@/lib/geo/silence";
import { WITHDRAW_REASONS } from "@/lib/rentals/settle";
import type { ScheduleStatus } from "@/lib/rentals/schedule";
import { dayKey, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";

export const dynamic = "force-dynamic";

const TYPE_STYLE: Record<string, string> = {
  vacancy_gap: "alert-card--gap",
  lease_expiry: "alert-card--lease",
  underpriced: "alert-card--underpriced",
  contract_expiry: "alert-card--contract",
  contract_ended: "alert-card--contract",
  rent_overdue: "alert-card--overdue",
  repossession_right: "alert-card--repossess",
  geofence_breach: "alert-card--geofence",
  tracker_silent: "alert-card--geofence",
};

interface AlertPayload {
  start?: string;
  end?: string;
  nights?: number;
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
  searchParams: Promise<{ view?: string }>;
}) {
  const operator = await requireOperator();

  const { view } = await searchParams;
  const done = view === "done";
  const locale = await getLocale();
  const alerts = await prisma.alert.findMany({
    where: { operatorId: operator.id, status: done ? "resolved" : "open" },
    include: { unit: { select: { id: true, name: true, nameKa: true, currency: true } } },
    orderBy: done ? { resolvedAt: "desc" } : { createdAt: "desc" },
    take: done ? 50 : undefined,
  });

  // Older alerts carry no category — it is looked up from the asset.
  const categoryOf = await alertCategories(operator.id, alerts);

  const displayName = (unit: { name: string; nameKa: string | null } | null) =>
    unit ? (locale === "ka" && unit.nameKa ? unit.nameKa : unit.name) : "—";

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
  const money = formatDue;
  const owes = (status: ScheduleStatus | null | undefined) =>
    status != null && status.periodsOwed > 0 && status.amountDue > 0;

  const detail = (type: string, payload: AlertPayload, currency: string) => {
    switch (type) {
      case "vacancy_gap":
        return `${payload.start} → ${payload.end} · ${payload.nights} ${t(locale, "nights_short")}`;
      case "lease_expiry":
        return `${payload.tenantName ?? "—"} · ${payload.endDate} · ${payload.daysLeft} ${t(locale, "days_left")}`;
      case "underpriced":
        return `${payload.baseNightlyRate} → ${payload.suggestedRate} ${currency} · ADR ${payload.benchmarkAdr} (${payload.month})`;
      case "contract_expiry":
        return `${payload.assetName} · ${payload.tenantName ?? "—"} · ${
          payload.paymentAmount != null && payload.paymentPeriod
            ? `${formatAmount(payload.paymentAmount)} ${currency} / ${t(locale, periodWordKey(payload.paymentPeriod))}`
            : `${payload.monthlyRent} ${currency}`
        } · ${payload.endDate} · ${payload.daysLeft} ${t(locale, "days_left")}`;
      case "contract_ended": {
        const status = payload.contractId ? live.get(payload.contractId) : null;
        return [
          payload.assetName,
          payload.tenantName ?? "—",
          `${t(locale, "cstatus_ended")}: ${payload.endDate}`,
          // Rent still owed when it ended stays in sight.
          owes(status)
            ? `${t(locale, "alert_unpaid")}: ${money(status!.amountDue)} ${currencyOf.get(payload.contractId!) ?? currency}`
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
            payload.assetName,
            payload.plate,
            payload.tenantName ?? "—",
            owes(status)
              ? `${money(status.amountDue)} ${unit}`
              : t(locale, `pstate_${status.state}` as StringKey),
            `${t(locale, "pay_next_due")}: ${dayKey(status.nextDueDate)}`,
            `${t(locale, "pay_days_overdue")}: ${status.daysOverdue}/${status.graceDays}`,
          ]
            .filter(Boolean)
            .join(" · ");
        }
        return [
          payload.assetName,
          payload.plate,
          payload.tenantName ?? "—",
          payload.amountDue != null ? `${money(payload.amountDue)} ${unit}` : null,
          `${t(locale, "pay_next_due")}: ${payload.dueDate}`,
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
          payload.assetName,
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
          payload.assetName,
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "alerts_title")}</h1>
        {!done && (
          <form action={runAlertScan}>
            <button type="submit" className="btn-secondary">
              {t(locale, "alerts_scan")}
            </button>
          </form>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        <Link href="/alerts" className={`btn-chip ${done ? "" : "btn-chip--active"}`}>
          {t(locale, "alerts_active_tab")}
        </Link>
        <Link href="/alerts?view=done" className={`btn-chip ${done ? "btn-chip--active" : ""}`}>
          {t(locale, "alerts_done_tab")}
        </Link>
      </div>

      {alerts.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          {t(locale, done ? "alerts_done_empty" : "alerts_empty")}
        </p>
      ) : (
        alerts.map((alert) => {
          const payload = alert.payload as AlertPayload;
          const currency = alert.unit?.currency ?? "GEL";
          // Late rent on a flat is not a vehicle to take back.
          const category = categoryOf(payload);
          const property =
            alert.type === "repossession_right" &&
            category != null &&
            templateFamily(category) === "property";
          return (
            <div key={alert.id} className={`alert-card ${TYPE_STYLE[alert.type] ?? ""}`}>
              <div>
                <div className="alert-card__title">
                  {t(
                    locale,
                    property
                      ? "alert_repossession_right_property"
                      : (`alert_${alert.type}` as StringKey),
                  )}
                  {alert.unit && (
                    <>
                      {" "}
                      <Link href={`/calendar?unit=${alert.unit.id}`} className="link">
                        {displayName(alert.unit)}
                      </Link>
                    </>
                  )}
                </div>
                <div className="alert-card__detail">
                  {detail(alert.type, payload, currency)}
                </div>
                <div className="alert-card__action">
                  <b>{t(locale, "alert_action")}:</b>{" "}
                  {t(
                    locale,
                    property
                      ? "action_repossession_right_property"
                      : (`action_${alert.type}` as StringKey),
                  )}
                </div>
              </div>
              {done ? (
                <div className="flex flex-col items-end gap-1">
                  <span className="badge badge--rented">
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
        })
      )}
    </main>
  );
}
