import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { siteUrl } from "@/lib/site";
import { evaluateFence, shapeFromRow } from "@/lib/geo/fence";
import { statusFor } from "@/lib/rentals/monitor";
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
  TEMPLATE_KEYS,
  type TemplateKey,
} from "@/lib/notify/templates";
import { waLink } from "@/lib/notify/phone";
import { whatsappConfig } from "@/lib/notify/whatsapp";
import ScheduleForm from "./schedule-form";
import GpsForm from "./gps-form";
import FenceForm from "./fence-form";
import TemplatesForm, { type TemplateField } from "./templates-form";

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
  "error_device_taken", "error_fence_points",
  "pay_period", "period_daily", "period_weekly", "period_monthly",
  "pay_amount", "pay_amount_hint", "pay_grace", "pay_grace_hint",
  "pay_paid_through", "pay_paid_through_hint", "pay_record", "pay_received",
  "pay_date", "pay_method", "method_cash", "method_transfer", "method_card",
  "method_other", "pay_note", "pay_partial_hint",
  "asset_plate", "asset_plate_hint",
  "gps_device_id", "gps_label", "gps_provider", "gps_connect", "gps_token",
  "gps_endpoint", "gps_endpoint_hint",
  "fence_name", "fence_kind", "fence_circle", "fence_polygon", "fence_center",
  "fence_radius", "fence_points", "fence_points_hint", "fence_approach",
  "fence_approach_hint", "fence_add", "fence_use_location",
  "tpl_notify_phone", "tpl_notify_phone_hint", "tpl_vars_hint", "tpl_save",
];

// The rental service for one asset: what the renter owes and when, where
// the vehicle is allowed to go, and every message that goes out about it.
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
  const now = new Date();
  const displayName = locale === "ka" && asset.nameKa ? asset.nameKa : asset.name;

  const labels = Object.fromEntries(LABEL_KEYS.map((key) => [key, t(locale, key)]));

  // ── The contract the schedule follows ──
  const contract =
    asset.contracts.find(
      (c) => c.status === "active" || (c.startDate <= now && c.endDate >= now),
    ) ?? null;
  // Without a paid-through date the schedule was never tracked, so the
  // numbers would be fiction — the page asks for the starting point instead.
  const tracked = contract?.paidThrough != null;
  const status = contract && tracked ? statusFor(contract, now) : null;
  const payments = contract
    ? await prisma.rentPayment.findMany({
        where: { contractId: contract.id },
        orderBy: { paidAt: "desc" },
        take: 12,
      })
    : [];

  // ── Where the vehicle stands right now, per fence ──
  const device = asset.gpsDevice;
  const position =
    device?.lastLat != null && device.lastLng != null
      ? { lat: device.lastLat, lng: device.lastLng }
      : null;
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
  const templateFields: TemplateField[] = TEMPLATE_KEYS.map((key) => {
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

  const intl = locale === "ka" ? "ka-GE" : "en-GB";
  const fmtDate = new Intl.DateTimeFormat(intl, {
    day: "numeric", month: "short", year: "numeric",
  });
  // Compact form for the KPI tiles, so a date never wraps onto two lines.
  const fmtShort = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
  const fmtStamp = new Intl.DateTimeFormat(intl, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const money = (value: number) => Math.round(value).toLocaleString("en-US");

  return (
    <main>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "rental_service")}</h1>
        <Link href={`/assets/${asset.id}/edit`} className="btn-chip">
          ← {displayName}
        </Link>
      </div>
      <p style={{ color: "var(--color-text-muted)", maxWidth: 640 }}>
        {t(locale, "rental_service_intro")}
      </p>

      {/* ── 1. Payment schedule ──────────────────────────────────────── */}
      <section>
        <h2>{t(locale, "pay_schedule_title")}</h2>
        <p className="field-hint" style={{ maxWidth: 640, marginTop: -6 }}>
          {t(locale, "pay_schedule_intro")}
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
                <div style={{ marginTop: 10 }}>
                  <span className={`badge ${STATE_BADGE[status.state]}`}>
                    {t(locale, `pstate_${status.state}` as StringKey)}
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
                  {money(status.amountDue)}
                  <span className="kpi__unit"> {contract.currency}</span>
                </div>
              </div>
            </div>
            )}

            {status && status.state !== "ok" && status.state !== "ended" && (
              <p className="field-hint" style={{ marginTop: -8, marginBottom: 14 }}>
                {t(locale, "pay_repossess_from")}:{" "}
                <b>{fmtDate.format(status.repossessFrom)}</b>
              </p>
            )}

            <ScheduleForm
              assetId={asset.id}
              contractId={contract.id}
              currency={contract.currency}
              defaults={{
                paymentPeriod: contract.paymentPeriod,
                paymentAmount: contract.paymentAmount?.toString() ?? "",
                graceDays: String(contract.graceDays),
                paidThrough: contract.paidThrough ? iso(contract.paidThrough) : "",
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
                          ({iso(payment.periodStart)} → {iso(payment.periodEnd)})
                        </span>
                        {payment.note ? ` · ${payment.note}` : ""}
                      </div>
                      <form action={deletePayment}>
                        <input type="hidden" name="assetId" value={asset.id} />
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <button type="submit" className="btn-chip" aria-label="delete payment">
                          ✕
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {/* ── 2. GPS ───────────────────────────────────────────────────── */}
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

      {/* ── 3. Red lines ─────────────────────────────────────────────── */}
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
                  {reading && (
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

      {/* ── 4. Messages ──────────────────────────────────────────────── */}
      <section>
        <h2>{t(locale, "tpl_title")}</h2>
        <p className="field-hint" style={{ maxWidth: 640, marginTop: -6 }}>
          {t(locale, "tpl_intro")}
        </p>
        <p className="alert-card" style={{ display: "block", fontSize: 13 }}>
          {t(locale, "tpl_disclaimer")}
        </p>

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
                      {t(
                        locale,
                        message.toRole === "driver" ? "outbox_to_driver" : "outbox_to_owner",
                      )}
                    </span>
                    <span
                      className={`badge ${
                        message.status === "sent"
                          ? "badge--vacant"
                          : message.status === "failed"
                            ? "badge--danger"
                            : "badge--str"
                      }`}
                    >
                      {t(locale, `outbox_status_${message.status}` as StringKey)}
                    </span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      +{message.toPhone} · {fmtStamp.format(message.createdAt)}
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{message.body}</p>
                  {message.error && (
                    <p style={{ margin: "4px 0 0", color: "var(--status-danger-text)" }}>
                      {message.error}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {message.status !== "sent" && (
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
