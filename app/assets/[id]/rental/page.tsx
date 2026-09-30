import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { asLocale, t, type StringKey } from "@/lib/i18n/strings";
import { siteUrl } from "@/lib/site";
import { evaluateFence, shapeFromRow } from "@/lib/geo/fence";
import { isTrackerSilent, silenceSpan } from "@/lib/geo/silence";
import {
  periodAmount,
  settlementContract,
  statusFor,
  unsettledContracts,
} from "@/lib/rentals/terms";
import { activeContract, contractPhase } from "@/lib/rentals/phase";
import { DESK_TABS, deskTab, rentalDesk, type DeskTab } from "@/lib/rentals/desk";
import { rentLabel } from "@/lib/rentals/display";
import { firstParam, type QueryValue } from "@/lib/params";
import { formatDueMoney, formatMoney } from "@/lib/format";
import { badgeClass, PAYMENT_TONE, toneOf, ZONE_TONE } from "@/lib/ui/tone";
import { SeverityIcon } from "@/app/alert-icon";
import { IconArrowRight, IconClose, IconEdit } from "@/app/icons";
import { asPeriod } from "@/lib/rentals/amount";
import { defaultPaidThrough } from "@/lib/rentals/schedule";
import { stalePaymentMessage, type WithdrawReason } from "@/lib/rentals/settle";
import { dayKey, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import {
  deleteGeofence,
  deleteGpsDevice,
  deletePayment,
  retryOutbox,
  rotateGpsToken,
  toggleGeofence,
} from "@/lib/rentals/actions";
import {
  DEFAULT_TEMPLATES,
  templateKeysFor,
  type TemplateKey,
} from "@/lib/notify/templates";
import { autoSendFor } from "@/lib/notify/whatsapp";
import ScheduleForm from "./schedule-form";
import GpsForm from "./gps-form";
import FenceForm from "./fence-form";
import TemplatesForm, { type TemplateField } from "./templates-form";
import ConfirmSubmit from "./confirm-submit";
import OutboxList, { type OutboxItem } from "@/app/outbox-list";
import { titled } from "@/lib/i18n/metadata";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("rental_service");

// Payment states and red-line zones take their colour from the one
// semantic map (lib/ui/tone.ts): paid/safe green, grace/approaching amber,
// repossession/outside red, not started/ended grey.
const STATE_TONE = {
  ...PAYMENT_TONE,
  due: "warn",
  not_started: "muted",
  ended: "muted",
} as const;

const LABEL_KEYS: StringKey[] = [
  "aria_lat", "aria_lng",
  "save", "cancel", "delete",
  "error_required", "error_invalid_number", "error_dates",
  "error_device_taken", "error_fence_points", "error_template_too_long",
  "error_fence_center", "error_fence_radius", "error_fence_approach",
  "pay_period", "period_daily", "period_weekly", "period_monthly",
  "pay_amount", "pay_amount_hint", "pay_grace", "pay_grace_hint",
  "pay_paid_through", "pay_paid_through_hint", "contract_reminders",
  "pay_grace_hint_property", "error_untracked",
  "pay_record", "pay_received",
  "pay_date", "pay_method", "method_cash", "method_transfer", "method_card",
  "method_other", "pay_note", "pay_partial_hint",
  "asset_plate", "asset_plate_hint",
  "gps_device_id", "gps_label", "gps_provider", "gps_connect", "gps_token",
  "gps_endpoint", "gps_endpoint_hint", "gps_tech_details", "gps_example", "gps_tech_note",
  "fence_name", "fence_kind", "fence_circle", "fence_polygon", "fence_center",
  "fence_radius", "fence_points", "fence_points_hint", "fence_approach",
  "fence_approach_hint", "fence_add", "fence_use_location",
  "fence_presets", "fence_preset_tbilisi30", "fence_preset_tbilisi50",
  "fence_preset_batumi20", "fence_preset_kutaisi20", "fence_preset_georgia",
  "fence_preset_hint",
  "tpl_notify_phone", "tpl_notify_phone_hint", "tpl_vars_hint", "tpl_save", "tpl_edited",
];

// The rental service for one asset — only for what is actually rented out
// (lib/rentals/desk.ts). A vehicle gets the full desk in four tabs:
// overview, payments, GPS (tracker and red lines), messages; a rented car
// opens on its payments, and the one-time setup (plate, tracker, message
// texts) stays folded under "Settings". Real estate gets one page with the
// payment schedule, the payment log and tenant messages — no car tooling.
// Crypto, stocks, metals and income streams have no desk at all.
export default async function RentalServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const { id } = await params;

  const asset = await prisma.asset.findFirst({
    where: { id, operatorId: operator.id },
    include: {
      gpsDevice: true,
      geofences: { orderBy: { createdAt: "asc" } },
      contracts: { orderBy: { endDate: "desc" } },
    },
  });
  if (!asset) notFound();
  const desk = rentalDesk(asset.category, asset.contracts.length);
  if (!desk) notFound();

  const locale = await getLocale();
  const today = startOfTodayTbilisi();
  const displayName = locale === "ka" && asset.nameKa ? asset.nameKa : asset.name;
  const isVehicle = desk === "vehicle";

  const labels = Object.fromEntries(LABEL_KEYS.map((key) => [key, t(locale, key)]));
  if (!isVehicle) {
    labels.pay_grace_hint = labels.pay_grace_hint_property;
    labels.tpl_vars_hint = t(locale, "tpl_vars_hint_property");
  }

  // ── The contract the schedule follows: the one running today, else the
  // next to start. A finished contract is no longer chased — but while it
  // still has rent owed it stays here, so the money can be recorded when
  // the renter pays. ──
  const contract = settlementContract(asset.contracts, today, asset) ?? null;
  const contractEnded = contract ? contractPhase(contract, today) === "ended" : false;
  const running = activeContract(asset.contracts, today) ?? null;
  // Other finished contracts that still owe money (the page follows a
  // running or upcoming one above).
  const otherUnsettled = unsettledContracts(asset.contracts, today, asset).filter(
    (other) => other.id !== contract?.id,
  );
  // Without a paid-up-to date the schedule was never tracked, so the
  // numbers would be fiction — the page asks for the starting point instead.
  const tracked = contract?.paidThrough != null;
  const status = contract && tracked ? statusFor(contract, today, asset) : null;
  const payments = contract
    ? await prisma.rentPayment.findMany({
        where: { contractId: contract.id },
        orderBy: { paidAt: "desc" },
        take: 12,
      })
    : [];

  // A rented car — or one whose finished contract still owes — opens on
  // its payments; otherwise on the overview.
  const tab: DeskTab = deskTab(
    firstParam((await searchParams).tab),
    running != null || contractEnded || otherUnsettled.length > 0,
  );

  // ── Where the vehicle stands right now, per fence ──
  // A position the tracker sent long ago says nothing about where the car
  // is now: once the tracker has gone quiet, every fence reads "unknown".
  const device = asset.gpsDevice;
  const now = new Date();
  const position =
    device?.lastLat != null && device.lastLng != null
      ? { lat: device.lastLat, lng: device.lastLng }
      : null;
  const silent = isTrackerSilent(device?.lastPingAt, now);
  const silence =
    silent && device?.lastPingAt ? silenceSpan(device.lastPingAt, now) : null;
  const fences = asset.geofences.map((fence) => {
    const shape = shapeFromRow(fence);
    const reading =
      shape && position ? evaluateFence(shape, fence.approachKm, position) : null;
    return { fence, reading };
  });

  const events = isVehicle
    ? await prisma.geoEvent.findMany({
        where: { assetId: asset.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
    : [];

  // ── Messages ──
  const overrides = await prisma.notifyTemplate.findMany({
    where: { operatorId: operator.id },
  });
  const overrideBy = new Map(overrides.map((row) => [row.key, row.body]));
  // Messages are written in the ACCOUNT's language (what the monitors
  // send), not necessarily the language this page is being read in.
  const messageLocale = asLocale(operator.locale);
  const templateFields: TemplateField[] = templateKeysFor(asset.category).map((key) => {
    const override = overrideBy.get(key);
    return {
      key,
      label: t(locale, `tplk_${key}` as StringKey),
      body: override?.trim() || DEFAULT_TEMPLATES[messageLocale][key as TemplateKey],
      isDefault: !override?.trim(),
    };
  });

  const me = await prisma.operator.findUnique({
    where: { id: operator.id },
    select: { notifyPhone: true },
  });

  const messages = await prisma.notifyMessage.findMany({
    where: { operatorId: operator.id, assetId: asset.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  // Never for the shared demo: its messages only get the manual send link.
  const autoSend = await autoSendFor(operator.id);
  // A reminder whose rent has been paid (or whose contract ended) since it
  // was queued must not be offered for sending, even before the next check
  // withdraws it.
  const contractById = new Map(asset.contracts.map((c) => [c.id, c]));
  const staleReason = (message: (typeof messages)[number]): WithdrawReason | null =>
    message.status === "queued" || message.status === "failed"
      ? message.contractId
        ? stalePaymentMessage(message, contractById.get(message.contractId) ?? null, today)
        : null
      : null;
  const outboxItems: OutboxItem[] = messages.map((message) => ({
    ...message,
    stale: staleReason(message),
    property: !isVehicle,
  }));
  const waiting = outboxItems.filter(
    (item) => (item.status === "queued" || item.status === "failed") && !item.stale,
  ).length;

  // Every date and time in Tbilisi time: a ping at 06:38 UTC is 10:38.
  const fmtDate = tbilisiFormat(locale, {
    day: "numeric", month: "short", year: "numeric",
  });
  // Compact form for the KPI tiles, so a date never wraps onto two lines.
  const fmtShort = tbilisiFormat("en", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
  const fmtStamp = tbilisiFormat(locale, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  const iso = dayKey;
  const tabHref = (key: DeskTab) => `/assets/${asset.id}/rental?tab=${key}`;
  const contractHref = `/assets/${asset.id}/edit#contracts`;

  // The one way forward when there is no contract (or none running) yet.
  const noContractKey: StringKey =
    asset.contracts.length > 0 ? "desk_no_running_contract" : "desk_no_contract";
  const noContract = (
    <div className="alert-card alert-card--info" style={{ alignItems: "center" }}>
      <span className="alert-card__notice">
        <SeverityIcon severity="info" />
        <span>{t(locale, noContractKey)}</span>
      </span>
      <Link href={contractHref} className="btn-primary btn-compact">
        {t(locale, "desk_add_contract")}
      </Link>
    </div>
  );

  // ── Payments: status, the schedule and the payment log ──────────────
  const paymentState = status
    ? contractEnded && status.periodsOwed > 0
      ? { tone: "danger" as const, label: t(locale, "alert_unpaid") }
      : {
          tone: toneOf(STATE_TONE, status.state),
          label: t(
            locale,
            status.state === "repossess" && !isVehicle
              ? "pstate_repossess_property"
              : (`pstate_${status.state}` as StringKey),
          ),
        }
    : null;

  const paymentsSection = (
    <section>
      <h2>{t(locale, "pay_schedule_title")}</h2>
      <p className="section-hint" style={{ maxWidth: 640 }}>
        {t(locale, isVehicle ? "pay_schedule_intro" : "pay_schedule_intro_property")}
      </p>

      {!contract ? (
        noContract
      ) : (
        <>
          {!status || !paymentState ? (
            <p className="alert-card alert-card--info" style={{ display: "block" }}>
              <span className="alert-card__notice">
                <SeverityIcon severity="info" />
                <span>{t(locale, "pay_untracked")}</span>
              </span>
            </p>
          ) : (
            <div className="kpi-grid kpi-grid--3d" style={{ marginBottom: 16 }}>
              <div className="kpi">
                <div className="kpi__label">{t(locale, "status_label")}</div>
                <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
                  {contractEnded && (
                    <span className={badgeClass("muted")}>{t(locale, "cstatus_ended")}</span>
                  )}
                  {/* Long states wrap inside the tile on a phone. A finished
                      contract is not "late" any more — its rent is unpaid. */}
                  <span
                    className={badgeClass(paymentState.tone)}
                    style={{ whiteSpace: "normal", height: "auto", minHeight: 26, paddingBlock: 3 }}
                  >
                    {paymentState.label}
                  </span>
                </div>
              </div>
              <div className="kpi">
                <div className="kpi__label">{t(locale, "pay_next_due")}</div>
                <div className="kpi__value">{fmtShort.format(status.nextDueDate)}</div>
              </div>
              <div className="kpi">
                <div className="kpi__label">{t(locale, "pay_days_overdue")}</div>
                <div className="kpi__value">
                  {status.daysOverdue}
                  <span className="kpi__unit"> / {status.graceDays}</span>
                </div>
              </div>
              <div className="kpi">
                <div className="kpi__label">{t(locale, "pay_amount_due")}</div>
                <div className="kpi__value">
                  {formatDueMoney(status.amountDue, contract.currency)}
                </div>
                {status.credit > 0 && (
                  <div className="kpi__sub">
                    {t(locale, "pay_credit")}: {formatMoney(status.credit, contract.currency, "auto")}
                  </div>
                )}
              </div>
            </div>
          )}

          {status && contractEnded && (
            <p className="field-hint" style={{ marginTop: -8, marginBottom: 14 }}>
              {t(locale, "pay_ended_owed").replace("{date}", fmtDate.format(contract.endDate))}
            </p>
          )}

          {status && !contractEnded && status.state !== "ok" && status.state !== "ended" && (
            <p className="field-hint" style={{ marginTop: -8, marginBottom: 14 }}>
              {isVehicle ? (
                <>
                  {t(locale, "pay_repossess_from")}:{" "}
                  <b>{fmtDate.format(status.repossessFrom)}</b>
                </>
              ) : (
                <>
                  {t(locale, "pay_grace_until")}:{" "}
                  <b>{fmtDate.format(status.graceEndsOn)}</b>
                </>
              )}
            </p>
          )}

          <ScheduleForm
            key={contract.id}
            assetId={asset.id}
            contractId={contract.id}
            currency={contract.currency}
            tracked={tracked}
            defaults={{
              paymentPeriod: contract.paymentPeriod,
              paymentAmount: String(periodAmount(contract)),
              graceDays: String(contract.graceDays),
              // Untracked: suggest the next due date, so one save starts
              // the schedule in good standing.
              paidThrough: iso(
                contract.paidThrough ??
                  defaultPaidThrough(
                    contract.startDate,
                    contract.endDate,
                    asPeriod(contract.paymentPeriod),
                    today,
                  ),
              ),
              remindersEnabled: contract.remindersEnabled,
            }}
            labels={labels}
          />

          {payments.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, marginTop: 20 }}>
                {t(locale, "pay_history")}
              </h3>
              <ul className="space-y-2">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="alert-card"
                    style={{ padding: "10px 16px", alignItems: "center" }}
                  >
                    <div style={{ fontSize: 13 }}>
                      <b>{formatMoney(payment.amount, payment.currency, "auto")}</b>{" "}
                      · {fmtDate.format(payment.paidAt)} ·{" "}
                      {t(locale, `method_${payment.method}` as StringKey)}
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {" "}
                        {payment.periodStart.getTime() === payment.periodEnd.getTime()
                          ? `(${t(locale, "pay_kept_credit")})`
                          : `(${fmtDate.format(payment.periodStart)} – ${fmtDate.format(payment.periodEnd)})`}
                      </span>
                      {payment.note ? ` · ${payment.note}` : ""}
                    </div>
                    {/* Only payments recorded since the balance was last
                        stated can be taken back — they are replayed. */}
                    {(!contract.openingAt || payment.createdAt > contract.openingAt) && (
                      <form action={deletePayment}>
                        <input type="hidden" name="assetId" value={asset.id} />
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <ConfirmSubmit
                          className="btn-chip btn-chip--icon btn-chip--danger"
                          ariaLabel={t(locale, "aria_delete_payment")}
                          message={t(locale, "pay_delete_confirm")}
                        >
                          <IconClose size={15} />
                        </ConfirmSubmit>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {/* Finished contracts that still owe money: not chased any more,
          but the money can still be recorded when it comes in. */}
      {otherUnsettled.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, marginTop: 24 }}>{t(locale, "pay_unsettled_title")}</h3>
          {otherUnsettled.map((other) => {
            const owed = statusFor(other, today, asset);
            return (
              <div key={other.id} style={{ marginBottom: 14 }}>
                <p className="alert-card" style={{ display: "block", fontSize: 13 }}>
                  <span className={badgeClass("muted")}>{t(locale, "cstatus_ended")}</span>{" "}
                  <b>{other.tenantName ?? "—"}</b> · {fmtDate.format(other.startDate)} –{" "}
                  {fmtDate.format(other.endDate)} · {t(locale, "pay_amount_due")}:{" "}
                  <b>{formatDueMoney(owed.amountDue, other.currency)}</b>
                </p>
                <ScheduleForm
                  key={other.id}
                  assetId={asset.id}
                  contractId={other.id}
                  currency={other.currency}
                  tracked
                  payOnly
                  defaults={{
                    paymentPeriod: other.paymentPeriod,
                    paymentAmount: String(periodAmount(other)),
                    graceDays: String(other.graceDays),
                    paidThrough: other.paidThrough ? iso(other.paidThrough) : "",
                    remindersEnabled: other.remindersEnabled,
                  }}
                  labels={labels}
                />
              </div>
            );
          })}
        </>
      )}
    </section>
  );

  // ── GPS (vehicles only): where the car is, its red lines, then setup ──
  const trackerLine = device ? (
    <div className="alert-card" style={{ alignItems: "center" }}>
      <div style={{ fontSize: 13 }}>
        <b>{t(locale, "gps_last_ping")}:</b>{" "}
        {position && device.lastPingAt ? (
          <>
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)} ·{" "}
            {fmtStamp.format(device.lastPingAt)}
            {device.lastSpeed != null
              ? ` · ${t(locale, "gps_speed")} ${Math.round(device.lastSpeed)} km/h`
              : ""}
          </>
        ) : (
          t(locale, "gps_never")
        )}
        {silence && (
          <div style={{ marginTop: 6 }}>
            <span className="badge badge--warn">
              {t(locale, "gps_silent").replace(
                "{span}",
                t(locale, `dur_${silence.unit}` as StringKey).replace("{n}", String(silence.n)),
              )}
            </span>
            <div style={{ color: "var(--color-text-muted)", marginTop: 4 }}>
              {t(locale, "gps_silent_hint")}
            </div>
          </div>
        )}
      </div>
    </div>
  ) : (
    <p className="alert-card alert-card--info" style={{ display: "block" }}>
      <span className="alert-card__notice">
        <SeverityIcon severity="info" />
        <span>{t(locale, "desk_no_tracker")}</span>
      </span>
    </p>
  );

  const gpsSection = (
    <>
      <section>
        <h2>{t(locale, "gps_title")}</h2>
        {trackerLine}
      </section>

      <section>
        <h2>{t(locale, "fence_title")}</h2>
        <p className="section-hint" style={{ maxWidth: 640 }}>
          {t(locale, "fence_intro")}
        </p>

        {fences.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "fence_none")}</p>
        ) : (
          <ul className="space-y-2" style={{ marginBottom: 16 }}>
            {fences.map(({ fence, reading }) => (
              <li
                key={fence.id}
                className="alert-card"
                style={{ padding: "12px 16px", alignItems: "center" }}
              >
                <div style={{ fontSize: 13 }}>
                  <b>{fence.name}</b>{" "}
                  <span className={badgeClass(fence.active ? "good" : "muted")}>
                    {t(locale, fence.active ? "fence_active" : "fence_paused")}
                  </span>
                  {reading && silent && (
                    // The last fix is too old to say which side of the line
                    // the car is on now — but where it was last seen still
                    // matters (a car that crossed the line and then went
                    // quiet is the theft pattern).
                    <>
                      <span
                        className={badgeClass(ZONE_TONE.unknown)}
                        style={{ marginLeft: 6 }}
                        title={t(locale, "gps_silent_hint")}
                      >
                        {t(locale, "fence_status_unknown")}
                      </span>
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 12,
                          color:
                            reading.zone === "outside"
                              ? "var(--status-danger-text)"
                              : "var(--color-text-muted)",
                          fontWeight: reading.zone === "outside" ? 600 : undefined,
                        }}
                      >
                        {t(locale, "fence_last_seen")
                          .replace("{zone}", t(locale, `fence_status_${reading.zone}` as StringKey))
                          .replace("{km}", reading.distanceKm.toFixed(1))}
                      </span>
                    </>
                  )}
                  {reading && !silent && (
                    <span className={badgeClass(toneOf(ZONE_TONE, reading.zone))} style={{ marginLeft: 6 }}>
                      {t(locale, `fence_status_${reading.zone}` as StringKey)} ·{" "}
                      {reading.distanceKm.toFixed(1)} km
                    </span>
                  )}
                  <div style={{ color: "var(--color-text-muted)", marginTop: 3 }}>
                    {fence.kind === "circle"
                      ? `${fence.centerLat?.toFixed(4)}, ${fence.centerLng?.toFixed(4)} · ${fence.radiusKm} km`
                      : `${t(locale, "fence_polygon")} · ${(fence.points as unknown[])?.length ?? 0}`}
                    {" · "}
                    {t(locale, "fence_approach")}: {fence.approachKm} km
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <form action={toggleGeofence}>
                    <input type="hidden" name="assetId" value={asset.id} />
                    <input type="hidden" name="fenceId" value={fence.id} />
                    <button type="submit" className="btn-chip">
                      {t(locale, fence.active ? "fence_pause" : "fence_resume")}
                    </button>
                  </form>
                  <form action={deleteGeofence}>
                    <input type="hidden" name="assetId" value={asset.id} />
                    <input type="hidden" name="fenceId" value={fence.id} />
                    <button
                      type="submit"
                      className="btn-chip btn-chip--icon btn-chip--danger"
                      aria-label={t(locale, "aria_delete_fence")}
                      title={t(locale, "aria_delete_fence")}
                    >
                      <IconClose size={15} />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Drawing a new line is occasional: folded until asked for,
            open when there is none yet. */}
        <details className="desk-fold" open={fences.length === 0 && device != null}>
          <summary>{t(locale, "desk_fence_new")}</summary>
          <FenceForm assetId={asset.id} labels={labels} />
        </details>

        <h3 style={{ fontSize: 15, marginTop: 20 }}>{t(locale, "fence_events")}</h3>
        {events.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
            {t(locale, "fence_no_events")}
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li key={event.id} className="alert-card" style={{ padding: "10px 16px" }}>
                <div style={{ fontSize: 13 }}>
                  <b>{t(locale, `fence_event_${event.kind}` as StringKey)}</b> ·{" "}
                  {fmtStamp.format(event.createdAt)} · {event.lat.toFixed(4)},{" "}
                  {event.lng.toFixed(4)} · {event.distanceKm.toFixed(1)} km
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* One-time setup: plate, tracker, the address it sends to. Open
          until a tracker is connected. */}
      <details className="desk-fold desk-fold--settings" open={device == null}>
        <summary>
          {t(locale, "desk_settings")}
          <span className="desk-fold__hint">{t(locale, "desk_settings_gps_hint")}</span>
        </summary>
        <p className="section-hint" style={{ maxWidth: 640 }}>
          {t(locale, "gps_intro")}
        </p>
        <GpsForm
          assetId={asset.id}
          plate={asset.plateNumber ?? ""}
          device={
            device
              ? {
                  deviceId: device.deviceId,
                  label: device.label ?? "",
                  provider: device.provider,
                  token: device.token,
                }
              : null
          }
          endpoint={`${siteUrl()}/api/gps/ping`}
          labels={labels}
        />
        {device && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
            <form action={rotateGpsToken}>
              <input type="hidden" name="assetId" value={asset.id} />
              <button type="submit" className="btn-chip">
                {t(locale, "gps_rotate")}
              </button>
            </form>
            <form action={deleteGpsDevice}>
              <input type="hidden" name="assetId" value={asset.id} />
              <button type="submit" className="btn-chip">
                {t(locale, "gps_remove")}
              </button>
            </form>
          </div>
        )}
      </details>
    </>
  );

  // ── Messages: what waits to be sent, then the texts (setup) ──────────
  const messagesSection = (
    <>
      <section>
        <div className="desk-head">
          <h2>{t(locale, isVehicle ? "outbox_title" : "tpl_title")}</h2>
          <Link href="/alerts?tab=outbox" className="btn-chip btn-chip--icon-text">
            {t(locale, "desk_all_outbox")} <IconArrowRight size={14} />
          </Link>
        </div>
        <p className="section-hint" style={{ maxWidth: 640, marginTop: 8 }}>
          {t(locale, "outbox_intro")}
        </p>
        <p className="alert-card alert-card--info" style={{ display: "block", fontSize: 13 }}>
          <span className="alert-card__notice">
            <SeverityIcon severity="info" />
            <span>{t(locale, autoSend ? "outbox_auto_on" : "outbox_auto_off")}</span>
          </span>
        </p>

        {outboxItems.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "outbox_empty")}</p>
        ) : (
          <OutboxList locale={locale} items={outboxItems} autoSend={autoSend} />
        )}

        {messages.some((message) => message.status === "failed") && (
          <form action={retryOutbox} style={{ marginTop: 12 }}>
            <input type="hidden" name="assetId" value={asset.id} />
            <button type="submit" className="btn-secondary">
              {t(locale, "outbox_retry")}
            </button>
          </form>
        )}
      </section>

      {/* One-time setup: the owner's number and the message texts. */}
      <details className="desk-fold desk-fold--settings">
        <summary>
          {t(locale, "desk_settings")}
          <span className="desk-fold__hint">{t(locale, "desk_settings_tpl_hint")}</span>
        </summary>
        <p className="section-hint" style={{ maxWidth: 640 }}>
          {t(locale, "tpl_intro")}
        </p>
        <p className="field-hint" style={{ maxWidth: 640 }}>
          {t(locale, messageLocale === "ka" ? "tpl_lang_ka" : "tpl_lang_en")}
        </p>
        {isVehicle && (
          <p className="alert-card alert-card--info" style={{ display: "block", fontSize: 13 }}>
            <span className="alert-card__notice">
              <SeverityIcon severity="info" />
              <span>{t(locale, "tpl_disclaimer")}</span>
            </span>
          </p>
        )}
        <TemplatesForm
          assetId={asset.id}
          notifyPhone={me?.notifyPhone ?? ""}
          fields={templateFields}
          labels={labels}
        />
      </details>
    </>
  );

  // ── Overview (vehicles): the contract, the money, the car, the messages ──
  const activeFences = fences.filter(({ fence }) => fence.active);
  // The car's worst standing across its active red lines.
  const zones = silent ? [] : activeFences.map(({ reading }) => reading?.zone).filter(Boolean);
  const worstZone =
    (["outside", "approach", "safe"] as const).find((zone) => zones.includes(zone)) ?? null;
  const shown = running ?? contract;

  const overviewSection = (
    <section>
      <div className="desk-grid">
        <div className="card desk-card">
          <div className="desk-card__label">{t(locale, "contracts_col")}</div>
          {shown ? (
            <>
              <div className="desk-card__value">{shown.tenantName ?? "—"}</div>
              <div className="desk-card__sub">
                {rentLabel(locale, shown)}
                {shown.tenantPhone ? ` · ${shown.tenantPhone}` : ""}
              </div>
              <div className="desk-card__sub">
                {fmtDate.format(shown.startDate)} – {fmtDate.format(shown.endDate)}{" "}
                <span className={badgeClass(contractPhase(shown, today) === "active" ? "good" : "muted")}>
                  {t(locale, `cstatus_${contractPhase(shown, today)}` as StringKey)}
                </span>
              </div>
              <Link href={contractHref} className="link desk-card__link">
                {t(locale, "edit")}
              </Link>
            </>
          ) : (
            <>
              <div className="desk-card__sub">{t(locale, noContractKey)}</div>
              <Link href={contractHref} className="btn-primary btn-compact desk-card__link">
                {t(locale, "desk_add_contract")}
              </Link>
            </>
          )}
        </div>

        <div className="card desk-card">
          <div className="desk-card__label">{t(locale, "desk_tab_payments")}</div>
          {status && paymentState ? (
            <>
              <div className="desk-card__value">{formatDueMoney(status.amountDue, contract!.currency)}</div>
              <div className="desk-card__sub">
                <span className={badgeClass(paymentState.tone)}>{paymentState.label}</span>{" "}
                {t(locale, "pay_days_overdue")}: {status.daysOverdue}/{status.graceDays}
              </div>
              <div className="desk-card__sub">
                {t(locale, "pay_next_due")}: {fmtDate.format(status.nextDueDate)}
              </div>
            </>
          ) : (
            <div className="desk-card__sub">
              {contract ? t(locale, "desk_untracked_short") : t(locale, noContractKey)}
            </div>
          )}
          <Link href={tabHref("payments")} className="link desk-card__link icon-text">
            {t(locale, "desk_open")} <IconArrowRight size={14} />
          </Link>
        </div>

        <div className="card desk-card">
          <div className="desk-card__label">{t(locale, "desk_tracker")}</div>
          {device ? (
            <>
              <div className="desk-card__sub">
                {silence ? (
                  <span className={badgeClass("warn")}>
                    {t(locale, "gps_silent").replace(
                      "{span}",
                      t(locale, `dur_${silence.unit}` as StringKey).replace("{n}", String(silence.n)),
                    )}
                  </span>
                ) : worstZone ? (
                  <span className={badgeClass(toneOf(ZONE_TONE, worstZone))}>
                    {t(locale, `fence_status_${worstZone}` as StringKey)}
                  </span>
                ) : device.lastPingAt ? (
                  `${t(locale, "gps_last_ping")}: ${fmtStamp.format(device.lastPingAt)}`
                ) : (
                  t(locale, "gps_never")
                )}
              </div>
              <div className="desk-card__sub">
                {t(locale, "desk_fences_count").replace("{n}", String(activeFences.length))}
              </div>
            </>
          ) : (
            <div className="desk-card__sub">{t(locale, "desk_no_tracker")}</div>
          )}
          <Link href={tabHref("gps")} className="link desk-card__link icon-text">
            {t(locale, "desk_open")} <IconArrowRight size={14} />
          </Link>
        </div>

        <div className="card desk-card">
          <div className="desk-card__label">{t(locale, "desk_tab_messages")}</div>
          <div className="desk-card__sub">
            {waiting > 0
              ? t(locale, "desk_to_send").replace("{n}", String(waiting))
              : t(locale, "desk_nothing_to_send")}
          </div>
          <Link href={tabHref("messages")} className="link desk-card__link icon-text">
            {t(locale, "desk_open")} <IconArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );

  const tabLabel: Record<DeskTab, string> = {
    overview: t(locale, "desk_tab_overview"),
    payments: t(locale, "desk_tab_payments"),
    gps: t(locale, "desk_tab_gps"),
    messages: waiting > 0 ? `${t(locale, "desk_tab_messages")} (${waiting})` : t(locale, "desk_tab_messages"),
  };

  return (
    <main>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <p className="desk-eyebrow">{t(locale, "rental_service")}</p>
          <h1 style={{ marginBottom: 0 }}>
            {displayName}
            {isVehicle && asset.plateNumber && (
              <span className="desk-plate">{asset.plateNumber}</span>
            )}
          </h1>
        </div>
        <Link href={`/assets/${asset.id}/edit`} className="btn-chip btn-chip--icon-text">
          <IconEdit size={14} /> {t(locale, "edit")}
        </Link>
      </div>

      {isVehicle ? (
        <>
          <nav className="desk-tabs" aria-label={t(locale, "desk_tabs_aria")}>
            {DESK_TABS.map((key) => (
              <Link
                key={key}
                href={tabHref(key)}
                className={`btn-chip${key === tab ? " btn-chip--active" : ""}`}
                aria-current={key === tab ? "page" : undefined}
                scroll={false}
              >
                {tabLabel[key]}
              </Link>
            ))}
          </nav>
          {tab === "overview" && (
            <>
              <p className="page-lead">{t(locale, "rental_service_intro")}</p>
              {overviewSection}
            </>
          )}
          {tab === "payments" && paymentsSection}
          {tab === "gps" && gpsSection}
          {tab === "messages" && messagesSection}
        </>
      ) : (
        <>
          {/* The property desk: rent and the tenant's messages, one page. */}
          <p className="page-lead">{t(locale, "rental_service_intro_property")}</p>
          {paymentsSection}
          {messagesSection}
        </>
      )}
    </main>
  );
}
