import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { siteUrl } from "@/lib/site";
import { evaluateFence, shapeFromRow } from "@/lib/geo/fence";
import { isTrackerSilent, silenceSpan } from "@/lib/geo/silence";
import {
  periodAmount,
  settlementContract,
  statusFor,
  unsettledContracts,
} from "@/lib/rentals/terms";
import { contractPhase } from "@/lib/rentals/phase";
import { formatDue, formatMoney } from "@/lib/rentals/money";
import { asPeriod } from "@/lib/rentals/amount";
import { defaultPaidThrough } from "@/lib/rentals/schedule";
import {
  stalePaymentMessage,
  WITHDRAW_REASONS,
  type WithdrawReason,
} from "@/lib/rentals/settle";
import { dayKey, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import {
  deleteGeofence,
  deleteGpsDevice,
  deleteMessage,
  deletePayment,
  markMessageSent,
  retryOutbox,
  rotateGpsToken,
  toggleGeofence,
} from "@/lib/rentals/actions";
import {
  DEFAULT_TEMPLATES,
  templateFamily,
  templateKeysFor,
  type TemplateKey,
} from "@/lib/notify/templates";
import { waLink } from "@/lib/notify/phone";
import { whatsappConfig } from "@/lib/notify/whatsapp";
import ScheduleForm from "./schedule-form";
import GpsForm from "./gps-form";
import FenceForm from "./fence-form";
import TemplatesForm, { type TemplateField } from "./templates-form";
import ConfirmSubmit from "./confirm-submit";

export const dynamic = "force-dynamic";

const STATE_BADGE: Record<string, string> = {
  not_started: "badge--listed",
  ok: "badge--vacant",
  due: "badge--str",
  grace: "badge--listed",
  repossess: "badge--danger",
  ended: "badge--personal",
};

const ZONE_BADGE: Record<string, string> = {
  safe: "badge--vacant",
  approach: "badge--listed",
  outside: "badge--danger",
};

const LABEL_KEYS: StringKey[] = [
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
  "tpl_notify_phone", "tpl_notify_phone_hint", "tpl_vars_hint", "tpl_save",
];

// The rental service for one asset: what the renter owes and when, every
// message that goes out about it — and, for vehicles only, the GPS tracker
// and the red lines. A flat gets no car tooling.
export default async function RentalServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const locale = await getLocale();
  const today = startOfTodayTbilisi();
  const displayName = locale === "ka" && asset.nameKa ? asset.nameKa : asset.name;
  const isVehicle = templateFamily(asset.category) === "vehicle";

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

  const events = await prisma.geoEvent.findMany({
    where: { assetId: asset.id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  // ── Messages ──
  const overrides = await prisma.notifyTemplate.findMany({
    where: { operatorId: operator.id },
  });
  const overrideBy = new Map(overrides.map((row) => [row.key, row.body]));
  const templateFields: TemplateField[] = templateKeysFor(asset.category).map((key) => {
    const override = overrideBy.get(key);
    return {
      key,
      label: t(locale, `tplk_${key}` as StringKey),
      body: override?.trim() || DEFAULT_TEMPLATES[locale][key as TemplateKey],
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
  const autoSend = whatsappConfig() != null;
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
  const withdrawnReason = (message: (typeof messages)[number]) =>
    message.status === "cancelled" &&
    WITHDRAW_REASONS.includes(message.cancelReason as WithdrawReason)
      ? (message.cancelReason as WithdrawReason)
      : null;

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
  const money = formatMoney;
  const roleLabel = (role: string) =>
    t(
      locale,
      role === "driver"
        ? "outbox_to_driver"
        : role === "tenant"
          ? "outbox_to_tenant"
          : "outbox_to_owner",
    );

  return (
    <main>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "rental_service")}</h1>
        <Link href={`/assets/${asset.id}/edit`} className="btn-chip">
          ← {displayName}
        </Link>
      </div>
      <p style={{ color: "var(--color-text-muted)", maxWidth: 640 }}>
        {t(locale, isVehicle ? "rental_service_intro" : "rental_service_intro_property")}
      </p>

      {/* ── 1. Payment schedule ──────────────────────────────────────── */}
      <section>
        <h2>{t(locale, "pay_schedule_title")}</h2>
        <p className="field-hint" style={{ maxWidth: 640, marginTop: -6 }}>
          {t(locale, isVehicle ? "pay_schedule_intro" : "pay_schedule_intro_property")}
        </p>

        {!contract ? (
          <p className="alert-card" style={{ display: "block" }}>
            {t(locale, "pay_no_contract")}
          </p>
        ) : (
          <>
            {!status ? (
              <p className="alert-card" style={{ display: "block" }}>
                {t(locale, "pay_untracked")}
              </p>
            ) : (
            <div className="kpi-grid kpi-grid--3d" style={{ marginBottom: 16 }}>
              <div className="kpi">
                <div className="kpi__label">{t(locale, "status_label")}</div>
                <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
                  {contractEnded && (
                    <span className="badge badge--personal">{t(locale, "cstatus_ended")}</span>
                  )}
                  {/* Long states wrap inside the tile on a phone. A finished
                      contract is not "late" any more — its rent is unpaid. */}
                  <span
                    className={`badge ${contractEnded && status.periodsOwed > 0 ? "badge--danger" : STATE_BADGE[status.state]}`}
                    style={{ whiteSpace: "normal", height: "auto", minHeight: 26, paddingBlock: 3 }}
                  >
                    {contractEnded && status.periodsOwed > 0
                      ? t(locale, "alert_unpaid")
                      : t(
                          locale,
                          status.state === "repossess" && !isVehicle
                            ? "pstate_repossess_property"
                            : (`pstate_${status.state}` as StringKey),
                        )}
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
                  {formatDue(status.amountDue)}
                  <span className="kpi__unit"> {contract.currency}</span>
                </div>
                {status.credit > 0 && (
                  <div className="kpi__sub">
                    {t(locale, "pay_credit")}: {money(status.credit)} {contract.currency}
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
                        <b>
                          {money(payment.amount)} {payment.currency}
                        </b>{" "}
                        · {fmtDate.format(payment.paidAt)} ·{" "}
                        {t(locale, `method_${payment.method}` as StringKey)}
                        <span style={{ color: "var(--color-text-muted)" }}>
                          {" "}
                          {payment.periodStart.getTime() === payment.periodEnd.getTime()
                            ? `(${t(locale, "pay_kept_credit")})`
                            : `(${iso(payment.periodStart)} → ${iso(payment.periodEnd)})`}
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
                            className="btn-chip"
                            ariaLabel={t(locale, "delete")}
                            message={t(locale, "pay_delete_confirm")}
                          >
                            ✕
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
                    <span className="badge badge--personal">{t(locale, "cstatus_ended")}</span>{" "}
                    <b>{other.tenantName ?? "—"}</b> · {fmtDate.format(other.startDate)} →{" "}
                    {fmtDate.format(other.endDate)} · {t(locale, "pay_amount_due")}:{" "}
                    <b>
                      {formatDue(owed.amountDue)} {other.currency}
                    </b>
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

      {/* ── 2. GPS (vehicles only) ─────────────────────────────────────── */}
      {isVehicle && (
      <section>
        <h2>{t(locale, "gps_title")}</h2>
        <p className="field-hint" style={{ maxWidth: 640, marginTop: -6 }}>
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
          <div className="alert-card" style={{ marginTop: 12, alignItems: "center" }}>
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
                  <span className="badge badge--danger">
                    {t(locale, "gps_silent").replace(
                      "{span}",
                      t(locale, `dur_${silence.unit}` as StringKey).replace(
                        "{n}",
                        String(silence.n),
                      ),
                    )}
                  </span>
                  <div style={{ color: "var(--color-text-muted)", marginTop: 4 }}>
                    {t(locale, "gps_silent_hint")}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
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
          </div>
        )}
      </section>
      )}

      {/* ── 3. Red lines (vehicles only) ───────────────────────────────── */}
      {isVehicle && (
      <section>
        <h2>{t(locale, "fence_title")}</h2>
        <p className="field-hint" style={{ maxWidth: 640, marginTop: -6 }}>
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
                  <span className={`badge ${fence.active ? "badge--vacant" : "badge--personal"}`}>
                    {t(locale, fence.active ? "fence_active" : "fence_paused")}
                  </span>
                  {reading && silent && (
                    // The last fix is too old to say which side of the line
                    // the car is on now — but where it was last seen still
                    // matters (a car that crossed the line and then went
                    // quiet is the theft pattern).
                    <>
                      <span
                        className="badge badge--personal"
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
                    <span className={`badge ${ZONE_BADGE[reading.zone]}`} style={{ marginLeft: 6 }}>
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
                    <button type="submit" className="btn-chip" aria-label="delete fence">
                      ✕
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <FenceForm assetId={asset.id} labels={labels} />

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
      )}

      {/* ── 4. Messages ──────────────────────────────────────────────── */}
      <section>
        <h2>{t(locale, "tpl_title")}</h2>
        <p className="field-hint" style={{ maxWidth: 640, marginTop: -6 }}>
          {t(locale, "tpl_intro")}
        </p>
        {isVehicle && (
          <p className="alert-card" style={{ display: "block", fontSize: 13 }}>
            {t(locale, "tpl_disclaimer")}
          </p>
        )}

        <TemplatesForm
          assetId={asset.id}
          notifyPhone={me?.notifyPhone ?? ""}
          fields={templateFields}
          labels={labels}
        />
      </section>

      {/* ── 5. Outbox ────────────────────────────────────────────────── */}
      <section>
        <h2>{t(locale, "outbox_title")}</h2>
        <p className="field-hint" style={{ maxWidth: 640, marginTop: -6 }}>
          {t(locale, "outbox_intro")}
        </p>
        <p className="alert-card" style={{ display: "block", fontSize: 13 }}>
          {t(locale, autoSend ? "outbox_auto_on" : "outbox_auto_off")}
        </p>

        {messages.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "outbox_empty")}</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((message) => (
              <li key={message.id} className="alert-card" style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 13, minWidth: 0 }}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="badge badge--listed">
                      {roleLabel(
                        // Older rows addressed a flat's tenant as "driver".
                        message.toRole === "driver" && !isVehicle ? "tenant" : message.toRole,
                      )}
                    </span>
                    <span
                      className={`badge ${
                        message.status === "sent" || message.status === "sending"
                          ? "badge--vacant"
                          : message.status === "failed"
                            ? "badge--danger"
                            : message.status === "cancelled"
                              ? "badge--personal"
                              : "badge--str"
                      }`}
                    >
                      {t(locale, `outbox_status_${message.status}` as StringKey)}
                    </span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      +{message.toPhone} · {fmtStamp.format(message.createdAt)}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "6px 0 0",
                      whiteSpace: "pre-wrap",
                      ...(message.status === "cancelled"
                        ? { color: "var(--color-text-muted)", textDecoration: "line-through" }
                        : {}),
                    }}
                  >
                    {message.body}
                  </p>
                  {withdrawnReason(message) && (
                    <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)" }}>
                      {t(locale, `withdraw_${withdrawnReason(message)}` as StringKey)} —{" "}
                      {t(locale, "outbox_not_sent")}
                      {withdrawnReason(message) === "changed" &&
                        ` ${t(locale, "outbox_changed_hint")}`}
                    </p>
                  )}
                  {staleReason(message) && (
                    <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)" }}>
                      {t(locale, `withdraw_${staleReason(message)}` as StringKey)} —{" "}
                      {t(locale, "outbox_stale")}
                    </p>
                  )}
                  {message.error && message.status !== "cancelled" && (
                    <p style={{ margin: "4px 0 0", color: "var(--status-danger-text)" }}>
                      {message.error === "interrupted" ? t(locale, "outbox_interrupted") : message.error}
                    </p>
                  )}
                  {autoSend && message.status === "queued" && !staleReason(message) && (
                    <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)" }}>
                      {t(locale, "outbox_auto_waiting")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {/* With automatic sending on, a queued message goes out by
                      itself: a manual link beside it could send it twice.
                      Only a failed one is offered for sending by hand. */}
                  {(message.status === "failed" || (message.status === "queued" && !autoSend)) &&
                    !staleReason(message) && (
                    <>
                      <a
                        href={waLink(message.toPhone, message.body)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-chip btn-chip--wa"
                      >
                        {t(locale, "outbox_send")} ↗
                      </a>
                      <form action={markMessageSent}>
                        <input type="hidden" name="assetId" value={asset.id} />
                        <input type="hidden" name="messageId" value={message.id} />
                        <button type="submit" className="btn-chip">
                          {t(locale, "outbox_mark_sent")}
                        </button>
                      </form>
                    </>
                  )}
                  <form action={deleteMessage}>
                    <input type="hidden" name="assetId" value={asset.id} />
                    <input type="hidden" name="messageId" value={message.id} />
                    <button type="submit" className="btn-chip" aria-label="delete message">
                      ✕
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
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
    </main>
  );
}
