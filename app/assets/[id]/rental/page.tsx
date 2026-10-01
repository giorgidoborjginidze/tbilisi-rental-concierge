import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator, readOnlyOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { asLocale, t, type StringKey } from "@/lib/i18n/strings";
import { shownOrigin } from "@/lib/site";
import { headers } from "next/headers";
import { evaluateFence, shapeFromRow } from "@/lib/geo/fence";
import { isTrackerSilent, silenceSpan } from "@/lib/geo/silence";
import {
  periodAmount,
  settlementContract,
  statusFor,
  unsettledContracts,
} from "@/lib/rentals/terms";
import { activeContract, contractPhase } from "@/lib/rentals/phase";
import FilesSection from "@/app/files/files-section";
import { DESK_TABS, deskTab, rentalDesk, type DeskTab } from "@/lib/rentals/desk";
import { rentLabel } from "@/lib/rentals/display";
import { firstParam, type QueryValue } from "@/lib/params";
import { formatDueMoney, formatMoney, formatNumber } from "@/lib/format";
import { badgeClass, PAYMENT_TONE, toneOf, ZONE_TONE } from "@/lib/ui/tone";
import { SeverityIcon } from "@/app/alert-icon";
import { IconArrowRight, IconClose, IconEdit } from "@/app/icons";
import { asPeriod } from "@/lib/rentals/amount";
import { defaultPaidThrough } from "@/lib/rentals/schedule";
import { staleMessageReasons, type WithdrawReason } from "@/lib/rentals/settle";
import { dayKey, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import {
  deleteGeofence,
  deleteGpsDevice,
  deletePayment,
  restorePayment,
  retryOutbox,
  rotateGpsToken,
  toggleGeofence,
} from "@/lib/rentals/actions";
import {
  DEFAULT_TEMPLATES,
  templateKeysFor,
  isFixedTemplate,
  type TemplateKey,
} from "@/lib/notify/templates";
import { autoSendFor } from "@/lib/notify/whatsapp";
import ScheduleForm from "./schedule-form";
import GpsForm from "./gps-form";
import FenceForm from "./fence-form";
import TemplatesForm, { type TemplateField } from "./templates-form";
import ConfirmAction from "@/app/confirm-action";
import OutboxList, { type OutboxItem } from "@/app/outbox-list";
import { outboxView, PENDING_STATUSES } from "@/lib/notify/outbox-view";
import { assetTitled } from "../asset-title";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import Kpi from "../../../kpi";

export const dynamic = "force-dynamic";

export const generateMetadata = assetTitled("rental_service");

const LABEL_KEYS: StringKey[] = [
  "aria_lat", "aria_lng",
  "save", "cancel", "delete",
  "error_required", "error_invalid_number", "error_dates", "error_contract_dates",
  "error_device_taken", "error_fence_points", "error_template_too_long",
  "error_fence_center", "error_fence_radius", "error_fence_approach",
  "pay_period", "period_daily", "period_weekly", "period_monthly",
  "pay_amount", "pay_amount_hint", "pay_grace", "pay_grace_hint",
  "pay_paid_through", "pay_paid_through_hint", "contract_reminders",
  "pay_grace_hint_property", "error_untracked",
  "pay_record", "pay_received", "saved_short", "pay_recorded",
  "pay_date", "pay_method", "method_cash", "method_transfer", "method_card",
  "method_other", "pay_note", "pay_partial_hint",
  "asset_plate", "asset_plate_hint",
  "gps_device_id", "gps_label", "gps_provider", "gps_connect", "gps_token",
  "gps_endpoint", "gps_endpoint_hint", "gps_tech_details", "gps_example", "gps_tech_note",
  "gps_check", "gps_check_ok", "gps_check_bad", "gps_check_error",
  "fence_name", "fence_kind", "fence_circle", "fence_polygon", "fence_center",
  "fence_radius", "fence_points", "fence_points_hint", "fence_approach",
  "fence_approach_hint", "fence_add", "fence_use_location",
  "fence_presets", "fence_preset_tbilisi30", "fence_preset_tbilisi50",
  "fence_preset_batumi20", "fence_preset_kutaisi20", "fence_preset_georgia",
  "fence_preset_hint", "fence_map_aria", "fence_map_hint_circle", "fence_map_hint_polygon",
  "fence_map_undo", "fence_map_clear", "fence_map_car",
  "tpl_notify_phone", "tpl_notify_phone_hint", "tpl_vars_hint", "tpl_save", "tpl_edited",
  "tpl_pay_to", "tpl_pay_to_hint", "tpl_pay_to_placeholder", "tpl_fixed_hint", "error_template_112",
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
  searchParams: Promise<{ tab?: QueryValue; added?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const { id } = await params;

  const [asset, locale] = await Promise.all([
    prisma.asset.findFirst({
      where: { id, operatorId: operator.id },
      include: {
        gpsDevice: true,
        geofences: { orderBy: { createdAt: "asc" } },
        contracts: { where: LIVE_CONTRACT, orderBy: { endDate: "desc" } },
      },
    }),
    getLocale(),
  ]);
  if (!asset) notFound();
  const desk = rentalDesk(asset.category, asset.contracts.length);
  if (!desk) notFound();

  const today = startOfTodayTbilisi();
  const displayName = locale === "ka" && asset.nameKa ? asset.nameKa : asset.name;
  const isVehicle = desk === "vehicle";

  const labels = Object.fromEntries(LABEL_KEYS.map((key) => [key, t(locale, key)]));
  // Distances in the reader's own unit word ("27.7 კმ"), one decimal at most.
  const km = (value: number) => `${formatNumber(Math.round(value * 10) / 10, "auto")} ${t(locale, "unit_km")}`;
  if (!isVehicle) {
    labels.pay_grace_hint = labels.pay_grace_hint_property;
    labels.tpl_vars_hint = t(locale, "tpl_vars_hint_property");
  } else {
    // A car has a driver, not a tenant.
    labels.pay_amount_hint = t(locale, "pay_amount_hint_driver");
    labels.contract_reminders = t(locale, "contract_reminders_driver");
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
  // Everything else the desk shows, read together (one round trip, not six).
  const [payments, events, overrides, me, messages, autoSend] = await Promise.all([
    contract
      ? prisma.rentPayment.findMany({
          where: { contractId: contract.id },
          orderBy: { paidAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    isVehicle
      ? prisma.geoEvent.findMany({
          where: { assetId: asset.id },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    prisma.notifyTemplate.findMany({
      where: { operatorId: operator.id },
    }),
    prisma.operator.findUnique({
      where: { id: operator.id },
      select: { notifyPhone: true, payInstructions: true, locale: true },
    }),
    // Everything still to go out (however old), and the latest handled ones.
    prisma.notifyMessage.findMany({
      where: {
        operatorId: operator.id,
        assetId: asset.id,
        OR: [
          { status: { in: ["queued", "failed", "sending"] } },
          { createdAt: { gte: new Date(today.getTime() - 60 * 86_400_000) } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    // Never for the shared demo: its messages only get the manual send link.
    autoSendFor(operator.id),
  ]);

  // A rented car — or one whose finished contract still owes — opens on
  // its payments; otherwise on the overview.
  const query = await searchParams;
  const justAdded = firstParam(query.added) === "1";
  const tab: DeskTab = deskTab(
    firstParam(query.tab),
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

  // ── Messages ──
  const overrideBy = new Map(overrides.map((row) => [row.key, row.body]));
  // Messages are written in the ACCOUNT's language (what the monitors
  // send), not necessarily the language this page is being read in.
  // (A team member may read the app in another language than the owner's.)
  const messageLocale = asLocale(me?.locale ?? operator.locale);
  const templateFields: TemplateField[] = templateKeysFor(asset.category).map((key) => {
    const override = overrideBy.get(key);
    return {
      key,
      label: t(locale, `tplk_${key}` as StringKey),
      body: isFixedTemplate(key)
        ? DEFAULT_TEMPLATES[messageLocale][key as TemplateKey]
        : override?.trim() || DEFAULT_TEMPLATES[messageLocale][key as TemplateKey],
      isDefault: isFixedTemplate(key) || !override?.trim(),
      fixed: isFixedTemplate(key),
    };
  });

  // ── Messages ──
  // Whatever no longer holds — paid rent, a car back inside its line,
  // hours-old red-line news, an objecting renter, a draft in the account's
  // earlier language — is never offered for sending, even before the next
  // check withdraws it (lib/rentals/settle.ts staleMessageReasons).
  const staleBy = await staleMessageReasons(
    prisma,
    messages.filter((message) => message.status === "queued" || message.status === "failed"),
    today,
  );
  const staleReason = (message: (typeof messages)[number]): WithdrawReason | null =>
    staleBy.get(message.id) ?? null;
  const outboxItems: OutboxItem[] = messages.map((message) => ({
    ...message,
    stale: staleReason(message),
    property: !isVehicle,
  }));
  // The same rule as the workspace outbox (lib/notify/outbox-view.ts): sent
  // by hand, a note to the owner would go from the owner's WhatsApp to the
  // owner's own number, so it is not offered here either — and not counted.
  const deskOutbox = outboxView(outboxItems, autoSend, new Date());
  const waitingIds = new Set(deskOutbox.waiting.map((item) => item.id));
  const history = outboxItems
    .filter((item) => !waitingIds.has(item.id) && (!PENDING_STATUSES.has(item.status) || item.stale))
    .slice(0, 20);
  const waiting = deskOutbox.waiting.length;

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
          tone: toneOf(PAYMENT_TONE, status.state),
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
          {/* An invoice for the rent owed now (or the next period), prefilled. */}
          <p style={{ margin: "0 0 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link href={`/invoices/new?contract=${contract.id}`} className="btn-chip">
              {t(locale, "invoice_make")}
            </Link>
            <Link href={`/invoices?asset=${asset.id}`} className="btn-chip">
              {t(locale, "invoices_title")}
            </Link>
          </p>
          {!status || !paymentState ? (
            <p className="alert-card alert-card--info" style={{ display: "block" }}>
              <span className="alert-card__notice">
                <SeverityIcon severity="info" />
                <span>{t(locale, "pay_untracked")}</span>
              </span>
            </p>
          ) : (
            <div className="kpi-grid kpi-grid--3d" style={{ marginBottom: 16 }}>
              <Kpi label={t(locale, "status_label")}>
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
              </Kpi>
              <Kpi label={t(locale, "pay_next_due")} value={fmtShort.format(status.nextDueDate)} />
              <Kpi
                label={t(locale, "pay_days_overdue")}
                value={
                  <>
                    {status.daysOverdue}
                    <span className="kpi__unit"> / {status.graceDays}</span>
                  </>
                }
              />
              <Kpi
                label={t(locale, "pay_amount_due")}
                value={formatDueMoney(status.amountDue, contract.currency)}
                sub={
                  status.credit > 0
                    ? `${t(locale, "pay_credit")}: ${formatMoney(status.credit, contract.currency, "auto")}`
                    : undefined
                }
              />
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

          {!contract.waConsentAt && !contract.messagesOptOutAt && (
            <p className="alert-card alert-card--warn" role="note" style={{ display: "block", fontSize: 13 }}>
              {t(locale, asset.category === "vehicle" ? "contract_no_consent_driver" : "contract_no_consent")}{" "}
              <Link href={`/assets/${asset.id}/edit#contracts`} className="link">
                {t(locale, "edit")}
              </Link>
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
                      <ConfirmAction
                        action={deletePayment}
                        undo={{ action: restorePayment, label: t(locale, "decide_undo"), done: t(locale, "deleted_undo_payment") }}
                        fields={{ assetId: asset.id, paymentId: payment.id }}
                        trigger={<IconClose size={15} />}
                        ariaLabel={t(locale, "aria_delete_payment")}
                        question={t(locale, "pay_delete_confirm")}
                        confirmLabel={t(locale, "delete")}
                        cancelLabel={t(locale, "cancel")}
                      />
                    )}
                  </li>
                ))}
              </ul>
              {/* Why some rows have no delete: said, not left to guess. */}
              {contract.openingAt &&
                payments.some((payment) => payment.createdAt <= contract.openingAt!) && (
                  <p className="field-hint" style={{ marginTop: 8 }}>
                    {t(locale, "pay_locked_note")}
                  </p>
                )}
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
              ? ` · ${t(locale, "gps_speed")} ${Math.round(device.lastSpeed)} ${t(locale, "unit_kmh")}`
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
                      {km(reading.distanceKm)}
                    </span>
                  )}
                  <div style={{ color: "var(--color-text-muted)", marginTop: 3 }}>
                    {fence.kind === "circle"
                      ? `${fence.centerLat?.toFixed(4)}, ${fence.centerLng?.toFixed(4)} · ${km(fence.radiusKm ?? 0)}`
                      : `${t(locale, "fence_polygon")} · ${(fence.points as unknown[])?.length ?? 0}`}
                    {" · "}
                    {t(locale, "fence_approach_short")}: {km(fence.approachKm)}
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
                  <ConfirmAction
                    action={deleteGeofence}
                    fields={{ assetId: asset.id, fenceId: fence.id }}
                    trigger={<IconClose size={15} />}
                    ariaLabel={t(locale, "aria_delete_fence")}
                    question={t(locale, "fence_delete_q").replace("{name}", fence.name)}
                    confirmLabel={t(locale, "delete")}
                    cancelLabel={t(locale, "cancel")}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Drawing a new line is occasional: folded until asked for,
            open when there is none yet. */}
        <details className="desk-fold" open={fences.length === 0 && device != null}>
          <summary>{t(locale, "desk_fence_new")}</summary>
          <FenceForm
            assetId={asset.id}
            labels={labels}
            saved={asset.geofences.map((fence) => ({
              name: fence.name,
              kind: fence.kind === "polygon" ? "polygon" : "circle",
              centerLat: fence.centerLat,
              centerLng: fence.centerLng,
              radiusKm: fence.radiusKm,
              points: Array.isArray(fence.points) ? (fence.points as [number, number][]) : undefined,
            }))}
            car={
              asset.gpsDevice?.lastLat != null && asset.gpsDevice.lastLng != null
                ? { lat: asset.gpsDevice.lastLat, lng: asset.gpsDevice.lastLng }
                : null
            }
          />
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
                  {event.lng.toFixed(4)} · {km(event.distanceKm)}
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
          {t(locale, "gps_intro")}{" "}
          {/* The setup, step by step, for the owner and the installer. */}
          <Link href="/learn#gps" className="link">
            {t(locale, "gps_lesson_link")}
          </Link>
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
          endpoint={`${shownOrigin(await headers())}/api/gps/ping`}
          labels={labels}
        />
        {device && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
            <ConfirmAction
              action={rotateGpsToken}
              fields={{ assetId: asset.id }}
              trigger={t(locale, "gps_rotate")}
              triggerClassName="btn-chip"
              question={t(locale, "gps_rotate_q")}
              confirmLabel={t(locale, "gps_rotate")}
              confirmClassName="btn-primary btn-compact"
              cancelLabel={t(locale, "cancel")}
            />
            <ConfirmAction
              action={deleteGpsDevice}
              fields={{ assetId: asset.id }}
              trigger={t(locale, "gps_remove")}
              triggerClassName="btn-chip"
              question={t(locale, "gps_remove_q")}
              confirmLabel={t(locale, "gps_remove")}
              cancelLabel={t(locale, "cancel")}
            />
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

        {deskOutbox.waiting.length === 0 && history.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "outbox_empty")}</p>
        ) : (
          <>
            {deskOutbox.waiting.length > 0 && (
              <OutboxList locale={locale} items={deskOutbox.waiting} autoSend={autoSend} />
            )}
            {history.length > 0 && (
              <details className="desk-fold" open={deskOutbox.waiting.length === 0}>
                <summary>{t(locale, "desk_outbox_history").replace("{n}", String(history.length))}</summary>
                <OutboxList locale={locale} items={history} autoSend={autoSend} />
              </details>
            )}
          </>
        )}
        {deskOutbox.hiddenOwner > 0 && (
          <p className="field-hint" style={{ marginTop: 10 }}>
            {t(locale, "alerts_outbox_owner_hidden").replace("{n}", String(deskOutbox.hiddenOwner))}
          </p>
        )}

        {deskOutbox.waiting.some((message) => message.status === "failed") && (
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
          {t(locale, messageLocale === "ka" ? (isVehicle ? "tpl_lang_ka_driver" : "tpl_lang_ka") : isVehicle ? "tpl_lang_en_driver" : "tpl_lang_en")}
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
          payInstructions={me?.payInstructions ?? ""}
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
          <p className="desk-eyebrow">
            {/* A car's desk is one of the fleet: the way back to the list. */}
            {isVehicle ? (
              <Link href="/fleet" className="link">
                {t(locale, "nav_fleet")}
              </Link>
            ) : null}
            {isVehicle ? " · " : null}
            {t(locale, "rental_service")}
          </p>
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

      {justAdded && (
        <p className="alert-card alert-card--good" role="status" style={{ display: "block", fontSize: 13 }}>
          {t(locale, "asset_added_note").replace("{name}", displayName)}
        </p>
      )}

      {isVehicle ? (
        <>
          <nav className="desk-tabs" aria-label={t(locale, "desk_tabs_aria")}>
            {DESK_TABS.map((key) => (
              <Link
                key={key}
                href={tabHref(key)}
                className={`btn-chip${key === tab ? " btn-chip--active" : ""}`}
                aria-current={key === tab ? "true" : undefined}
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
              {/* Handover photos, the technical passport, the driver's ID copy. */}
              <FilesSection place={{ assetId: asset.id }} locale={locale} operatorId={operator.id} readOnly={readOnlyOperator(operator)} />
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
          {/* Receipts and the signed contract, next to the payments they prove. */}
          <FilesSection
            place={{ assetId: asset.id }}
            locale={locale}
            operatorId={operator.id}
            readOnly={readOnlyOperator(operator)}
            defaultKind="receipt"
          />
        </>
      )}
    </main>
  );
}
