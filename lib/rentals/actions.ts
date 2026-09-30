"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { getWriter, requireWriter } from "@/lib/auth/session";
import type { FormState } from "@/lib/units/actions";
import type { StringKey } from "@/lib/i18n/strings";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/notify/templates";
import { flushOutbox } from "@/lib/notify/whatsapp";
import { MAX_TEMPLATE_CHARS } from "@/lib/notify/limits";
import { parsePolygon } from "@/lib/geo/fence";
import { startOfTodayTbilisi } from "@/lib/time";
import { loadAssetSources } from "@/lib/property/places";
import { MAX_MARKED_NIGHTS, nightsHeld, nightsToAnswer } from "@/lib/property/stays";
import { PAYMENT_PERIODS, snapToBoundary, type PaymentPeriod } from "./schedule";
import { monthlyEquivalent } from "./amount";
import { alignPaidThrough, applyPayment, replayLedger, restatesBalance } from "./ledger";
import { contractTerms, periodAmount } from "./terms";
import {
  resolveTrackerSilence,
  restoreAfterUndo,
  settlePaidRent,
  sweepStaleRentAlerts,
  withdrawFenceMessages,
} from "./settle";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

const optionalNumber = (formData: FormData, key: string): number | null => {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
};

/**
 * Confirm the asset belongs to the signed-in workspace — and that the
 * workspace may write (the shared demo may not: requireWriter).
 */
async function ownAsset(assetId: string) {
  const operator = await requireWriter();
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, operatorId: operator.id },
  });
  return asset ? { operator, asset } : null;
}

const refresh = (assetId: string) => {
  revalidatePath(`/assets/${assetId}/rental`);
  revalidatePath(`/assets/${assetId}/edit`);
  revalidatePath("/assets");
  revalidatePath("/alerts");
  revalidatePath("/");
};

// ── Payment schedule ────────────────────────────────────────────────────

/**
 * Save the payment terms of a contract: period, amount per period, grace
 * days, reminders — and "paid up to", the owner's statement of how far the
 * rent is paid. Restating that date, or changing the period or the amount,
 * opens a new ledger balance: payments recorded from then on are replayed
 * on top of it, so an older payment is never re-priced at a new rate.
 */
export async function saveSchedule(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const contractId = str(formData, "contractId");
  const assetId = str(formData, "assetId");
  if (!contractId || !assetId) return { error: "error_required" };

  const owned = await ownAsset(assetId);
  if (!owned) return { error: "error_required" };

  const period = str(formData, "paymentPeriod") as PaymentPeriod;
  if (!PAYMENT_PERIODS.includes(period)) return { error: "error_required" };

  const amount = optionalNumber(formData, "paymentAmount");
  if (amount == null || Number.isNaN(amount) || amount <= 0) {
    return { error: "error_invalid_number" };
  }
  const graceRaw = optionalNumber(formData, "graceDays");
  if (Number.isNaN(graceRaw) || graceRaw == null || graceRaw < 0 || graceRaw > 60) {
    return { error: "error_invalid_number" };
  }

  const contract = await prisma.rentalContract.findFirst({
    where: { id: contractId, assetId, ...LIVE_CONTRACT },
  });
  if (!contract) return { error: "error_required" };

  const next = {
    ...contract,
    paymentPeriod: period,
    paymentAmount: amount,
    monthlyRent: monthlyEquivalent(amount, period),
  };
  const terms = contractTerms(next, owned.asset);
  const termsChanged =
    period !== contract.paymentPeriod ||
    Math.abs(amount - periodAmount(contract)) >= 0.005;

  let ledger: {
    paidThrough: Date | null;
    creditBalance: number;
    openingPaidThrough: Date | null;
    openingCredit: number;
    openingAt: Date;
  } | null = null;

  const paidRaw = str(formData, "paidThrough");
  const typed = paidRaw ? new Date(`${paidRaw}T00:00:00Z`) : null;
  if (typed && Number.isNaN(typed.getTime())) return { error: "error_required" };
  const stated = typed
    ? snapToBoundary(contract.startDate, contract.endDate, period, typed)
    : null;

  // A restatement is the owner changing the date on screen. The form sends
  // back what it showed (paidThroughWas): a page loaded before a payment
  // was recorded elsewhere, or a period switch that moves the date onto a
  // new grid, must not roll the balance back or drop the credit.
  const restated = restatesBalance({
    stored: contract.paidThrough,
    typed: paidRaw,
    shown: formData.has("paidThroughWas") ? str(formData, "paidThroughWas") : null,
    stated,
  });

  if (restated && stated) {
    // The owner restates the balance: paid up to this date, no credit.
    ledger = {
      paidThrough: stated,
      creditBalance: 0,
      openingPaidThrough: stated,
      openingCredit: 0,
      openingAt: new Date(),
    };
  } else if (termsChanged) {
    // Same balance on new terms: carry it over, onto the new period grid.
    const paidThrough = contract.paidThrough
      ? alignPaidThrough(terms, contract.paidThrough)
      : null;
    ledger = {
      paidThrough,
      creditBalance: contract.creditBalance,
      openingPaidThrough: paidThrough,
      openingCredit: contract.creditBalance,
      openingAt: new Date(),
    };
  }

  const remindersEnabled = formData.has("remindersField")
    ? formData.get("remindersEnabled") === "on"
    : contract.remindersEnabled;

  await prisma.rentalContract.updateMany({
    where: { id: contractId, assetId, ...LIVE_CONTRACT },
    data: {
      paymentPeriod: period,
      paymentAmount: amount,
      monthlyRent: next.monthlyRent,
      graceDays: Math.round(graceRaw),
      remindersEnabled,
      ...(ledger ?? {}),
    },
  });
  // New terms, a new balance, other grace days or reminders switched off:
  // whatever is still waiting to go out was written under the old ones.
  // Alerts for due dates now paid close; the next scan queues fresh
  // reminders for what is still owed.
  const changed =
    ledger != null ||
    Math.round(graceRaw) !== contract.graceDays ||
    remindersEnabled !== contract.remindersEnabled;
  if (changed) {
    const now = new Date();
    await settlePaidRent(
      prisma,
      contractId,
      ledger ? ledger.paidThrough : contract.paidThrough,
      now,
      { cause: "changed", withdrawOwed: true },
    );
    // A new period moves the due dates onto a new grid: an open alert about
    // a date of the old grid would stand next to the one the next scan
    // raises. Only the current first unpaid due date keeps its alert.
    await sweepStaleRentAlerts(prisma, startOfTodayTbilisi(now), { contractId }, now);
  }

  refresh(assetId);
  return null;
}

/**
 * Record money received. It pays the owed periods in order, each at the
 * price the schedule shows for it; what does not cover a whole period is
 * kept as credit toward the next one. A part payment therefore leaves the
 * contract exactly as late as it was — and the money is not lost.
 */
export async function recordPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await receivePayment(formData);
  return "error" in result ? { error: result.error } : null;
}

export type ReceiveResult = { paymentId: string } | { error: StringKey };

/**
 * The same as recordPayment, for callers that need the new payment's id —
 * the dashboard's "received" card offers to undo it straight away.
 */
export async function receiveRent(formData: FormData): Promise<ReceiveResult> {
  // The card reads the result: the demo gets an error, not a redirect.
  if (!(await getWriter())) return { error: "error_demo_readonly" };
  return receivePayment(formData);
}

async function receivePayment(formData: FormData): Promise<ReceiveResult> {
  const contractId = str(formData, "contractId");
  const assetId = str(formData, "assetId");
  const amount = Number(str(formData, "amount"));
  if (!contractId || !assetId) return { error: "error_required" };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "error_invalid_number" };

  const owned = await ownAsset(assetId);
  if (!owned) return { error: "error_required" };

  const contract = await prisma.rentalContract.findFirst({
    where: { id: contractId, assetId, ...LIVE_CONTRACT },
  });
  if (!contract) return { error: "error_required" };
  // Without a paid-up-to date there is nothing to count the money from.
  if (!contract.paidThrough) return { error: "error_untracked" };

  const step = applyPayment(
    contractTerms(contract, owned.asset),
    { paidThrough: contract.paidThrough, credit: contract.creditBalance },
    amount,
  );

  const paidAtRaw = str(formData, "paidAt");
  const paidAt = paidAtRaw ? new Date(`${paidAtRaw}T00:00:00Z`) : startOfTodayTbilisi();
  if (Number.isNaN(paidAt.getTime())) return { error: "error_required" };

  const [payment] = await prisma.$transaction([
    prisma.rentPayment.create({
      data: {
        contractId,
        amount,
        currency: contract.currency,
        paidAt,
        periodStart: step.periodStart,
        periodEnd: step.periodEnd,
        method: str(formData, "method") || "cash",
        note: str(formData, "note") || null,
      },
    }),
    prisma.rentalContract.update({
      where: { id: contractId },
      data: { paidThrough: step.state.paidThrough, creditBalance: step.state.credit },
    }),
  ]);
  // The reminders and late alerts about this rent are now history (or
  // quote an amount that is no longer right): withdraw them.
  await settlePaidRent(prisma, contractId, step.state.paidThrough, payment.createdAt, {
    withdrawOwed: true,
  });

  refresh(assetId);
  return { paymentId: payment.id };
}

/**
 * Delete a payment and rebuild the schedule from the ledger's opening
 * balance and the payments that remain, so a period paid by a later
 * payment never re-opens. Payments from before the balance was last
 * restated are part of that statement and are not deleted here.
 */
export async function deletePayment(formData: FormData) {
  await removePayment(str(formData, "assetId"), str(formData, "paymentId"), false);
}

/**
 * Undo, straight after "received": the payment goes, and so does what it
 * withdrew — the late alert reopens and the reminder is back in the queue.
 */
export async function undoPayment(
  formData: FormData,
): Promise<{ ok: true } | { error: StringKey }> {
  if (!(await getWriter())) return { error: "error_demo_readonly" };
  const error = await removePayment(str(formData, "assetId"), str(formData, "paymentId"), true);
  return error ? { error } : { ok: true };
}

/**
 * `requeue`: the immediate undo puts back the reminders this payment
 * withdrew (they were written minutes ago). Deleting an older payment only
 * reopens its alerts — the next scan writes fresh reminders.
 */
async function removePayment(
  assetId: string,
  paymentId: string,
  requeue: boolean,
): Promise<StringKey | null> {
  const owned = assetId ? await ownAsset(assetId) : null;
  if (!owned || !paymentId) return "error_required";

  const payment = await prisma.rentPayment.findFirst({
    where: { id: paymentId, contract: { assetId, ...LIVE_CONTRACT } },
    include: { contract: true },
  });
  if (!payment) return "error_required";
  const contract = payment.contract;
  if (contract.openingAt && payment.createdAt <= contract.openingAt) return "error_payment_locked";

  const all = await prisma.rentPayment.findMany({
    where: {
      contractId: contract.id,
      ...(contract.openingAt ? { createdAt: { gt: contract.openingAt } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const remaining = all.filter((row) => row.id !== paymentId);

  // Contracts from before the ledger had an opening balance replay from
  // where their first recorded payment started.
  const openingPaidThrough =
    contract.openingPaidThrough ??
    (all.length > 0
      ? all.reduce(
          (min, row) => (row.periodStart < min ? row.periodStart : min),
          all[0].periodStart,
        )
      : contract.startDate);
  const replay = replayLedger(
    contractTerms(contract, owned.asset),
    { paidThrough: openingPaidThrough, credit: contract.openingAt ? contract.openingCredit : 0 },
    remaining.map((row) => row.amount),
  );

  await prisma.$transaction([
    prisma.rentPayment.delete({ where: { id: paymentId } }),
    prisma.rentalContract.update({
      where: { id: contract.id },
      data: {
        paidThrough: replay.state.paidThrough,
        creditBalance: replay.state.credit,
      },
    }),
    // Keep each remaining row's window true to the replayed schedule.
    ...remaining.map((row, i) =>
      prisma.rentPayment.update({
        where: { id: row.id },
        data: {
          periodStart: replay.applied[i].periodStart,
          periodEnd: replay.applied[i].periodEnd,
        },
      }),
    ),
  ]);
  // What this payment withdrew comes back if its due date is unpaid again.
  const restored = await restoreAfterUndo(
    prisma,
    contract.id,
    replay.state.paidThrough,
    payment.createdAt,
    { requeue },
  );
  // Back in the queue: with automatic sending on, it goes out now.
  if (restored.requeued > 0) await flushOutbox(owned.operator.id).catch(() => undefined);
  refresh(assetId);
  return null;
}

// ── GPS device ──────────────────────────────────────────────────────────

export async function saveGpsDevice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const assetId = str(formData, "assetId");
  const deviceId = str(formData, "deviceId");
  if (!assetId || !deviceId) return { error: "error_required" };

  const owned = await ownAsset(assetId);
  if (!owned) return { error: "error_required" };

  // The tracker's own id must be unique platform-wide, since the ingest
  // endpoint identifies devices by it alone.
  const clash = await prisma.gpsDevice.findUnique({ where: { deviceId } });
  if (clash && clash.assetId !== assetId) return { error: "error_device_taken" };

  const label = str(formData, "label") || null;
  const provider = str(formData, "provider") || "generic";

  await prisma.gpsDevice.upsert({
    where: { assetId },
    update: { deviceId, label, provider },
    create: {
      assetId,
      deviceId,
      label,
      provider,
      token: randomBytes(24).toString("base64url"),
    },
  });

  refresh(assetId);
  return null;
}

export async function rotateGpsToken(formData: FormData) {
  const assetId = str(formData, "assetId");
  const owned = assetId ? await ownAsset(assetId) : null;
  if (!owned) return;
  await prisma.gpsDevice.updateMany({
    where: { assetId },
    data: { token: randomBytes(24).toString("base64url") },
  });
  refresh(assetId);
}

export async function deleteGpsDevice(formData: FormData) {
  const assetId = str(formData, "assetId");
  const owned = assetId ? await ownAsset(assetId) : null;
  if (!owned) return;
  await prisma.gpsDevice.deleteMany({ where: { assetId } });
  // No tracker, no ping to close a "tracker silent" alert: close it now.
  await resolveTrackerSilence(prisma, owned.operator.id, assetId, new Date(), "not_monitored");
  refresh(assetId);
}

/** With no active red line left, a "tracker silent" alert no longer applies. */
async function closeSilenceIfUnwatched(operatorId: string, assetId: string) {
  const active = await prisma.geofence.count({ where: { assetId, active: true } });
  if (active === 0) {
    await resolveTrackerSilence(prisma, operatorId, assetId, new Date(), "not_monitored");
  }
}

// ── Red lines ───────────────────────────────────────────────────────────

export async function saveGeofence(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const assetId = str(formData, "assetId");
  const name = str(formData, "name");
  if (!assetId || !name) return { error: "error_required" };

  const owned = await ownAsset(assetId);
  if (!owned) return { error: "error_required" };

  const kind = str(formData, "kind") === "polygon" ? "polygon" : "circle";
  const approachRaw = optionalNumber(formData, "approachKm");
  if (Number.isNaN(approachRaw) || (approachRaw != null && approachRaw <= 0)) {
    return { error: "error_fence_approach" };
  }
  const approachKm = approachRaw ?? 1;

  let data: Record<string, unknown>;
  if (kind === "polygon") {
    // Pasted as "lat, lng" per line — the format a phone map app copies out.
    const points = parsePolygon(
      str(formData, "points")
        .split(/\r?\n/)
        .map((line) => line.split(/[,;]/).map((part) => Number(part.trim())))
        .filter((pair) => pair.length >= 2),
    );
    if (points.length < 3) return { error: "error_fence_points" };
    data = { kind, points, centerLat: null, centerLng: null, radiusKm: null };
  } else {
    const centerLat = optionalNumber(formData, "centerLat");
    const centerLng = optionalNumber(formData, "centerLng");
    const radiusKm = optionalNumber(formData, "radiusKm");
    if (
      centerLat == null || Number.isNaN(centerLat) ||
      centerLng == null || Number.isNaN(centerLng) ||
      centerLat < -90 || centerLat > 90 || centerLng < -180 || centerLng > 180
    ) {
      return { error: "error_fence_center" };
    }
    if (radiusKm == null || Number.isNaN(radiusKm) || radiusKm <= 0) {
      return { error: "error_fence_radius" };
    }
    data = { kind, centerLat, centerLng, radiusKm, points: undefined };
  }

  const fenceId = str(formData, "fenceId");
  if (fenceId) {
    await prisma.geofence.updateMany({
      where: { id: fenceId, assetId },
      data: { name, approachKm, ...data },
    });
  } else {
    await prisma.geofence.create({
      data: { assetId, name, approachKm, ...data } as never,
    });
  }

  refresh(assetId);
  return null;
}

export async function toggleGeofence(formData: FormData) {
  const assetId = str(formData, "assetId");
  const fenceId = str(formData, "fenceId");
  const owned = assetId ? await ownAsset(assetId) : null;
  if (!owned || !fenceId) return;
  const fence = await prisma.geofence.findFirst({ where: { id: fenceId, assetId } });
  if (!fence) return;
  // Switched off: its warnings still waiting to go out are withdrawn.
  if (fence.active) await withdrawFenceMessages(prisma, [fence.id], "fence_off");
  await prisma.geofence.update({
    where: { id: fenceId },
    data: { active: !fence.active },
  });
  if (fence.active) await closeSilenceIfUnwatched(owned.operator.id, assetId);
  refresh(assetId);
}

export async function deleteGeofence(formData: FormData) {
  const assetId = str(formData, "assetId");
  const fenceId = str(formData, "fenceId");
  const owned = assetId ? await ownAsset(assetId) : null;
  if (!owned || !fenceId) return;
  const fence = await prisma.geofence.findFirst({ where: { id: fenceId, assetId } });
  if (!fence) return;
  // Before the events go with it: the dedupe keys of its unsent warnings
  // point at them.
  await withdrawFenceMessages(prisma, [fence.id], "fence_removed");
  await prisma.geofence.deleteMany({ where: { id: fenceId, assetId } });
  await closeSilenceIfUnwatched(owned.operator.id, assetId);
  refresh(assetId);
}

// ── Notification setup ──────────────────────────────────────────────────

export async function saveNotifySetup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireWriter();
  const assetId = str(formData, "assetId");

  // Messages go out on one line and are kept short (lib/notify/limits.ts).
  for (const key of TEMPLATE_KEYS) {
    if ([...str(formData, `tpl_${key}`)].length > MAX_TEMPLATE_CHARS) {
      return { error: "error_template_too_long" };
    }
  }

  await prisma.operator.update({
    where: { id: operator.id },
    data: { notifyPhone: str(formData, "notifyPhone") || null },
  });

  // A template row exists only while it differs from the default, so
  // clearing a field restores the built-in wording. Only the templates the
  // form actually showed are touched: a flat's page lists the lease texts,
  // a car's page the vehicle texts, and neither may wipe the other's.
  for (const key of TEMPLATE_KEYS) {
    if (!formData.has(`tpl_${key}`)) continue;
    const body = str(formData, `tpl_${key}`);
    if (!body) {
      await prisma.notifyTemplate.deleteMany({
        where: { operatorId: operator.id, key },
      });
      continue;
    }
    await prisma.notifyTemplate.upsert({
      where: { operatorId_key: { operatorId: operator.id, key: key as TemplateKey } },
      update: { body },
      create: { operatorId: operator.id, key, body },
    });
  }

  if (assetId) refresh(assetId);
  revalidatePath("/settings");
  return null;
}

/** Save the vehicle's state plate — it is quoted verbatim in the messages. */
export async function savePlate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const assetId = str(formData, "assetId");
  const owned = assetId ? await ownAsset(assetId) : null;
  if (!owned) return { error: "error_required" };
  await prisma.asset.update({
    where: { id: assetId },
    data: { plateNumber: str(formData, "plateNumber").toUpperCase() || null },
  });
  refresh(assetId);
  return null;
}

// ── Outbox ──────────────────────────────────────────────────────────────

/** Mark a queued message as handled after the operator sent it by hand. */
export async function markMessageSent(formData: FormData) {
  const operator = await requireWriter();
  const messageId = str(formData, "messageId");
  const assetId = str(formData, "assetId");
  if (!messageId) return;
  await prisma.notifyMessage.updateMany({
    where: { id: messageId, operatorId: operator.id },
    data: { status: "sent", sentAt: new Date(), error: null },
  });
  if (assetId) refresh(assetId);
  else revalidatePath("/alerts");
}

/**
 * Remove a message that has not gone out. It is kept as withdrawn by the
 * owner ("owner") rather than deleted: its dedupe key then stops the next
 * check from queueing the very same message again, and it can be put back
 * (restoreMessage). A message already sent is history and stays.
 */
export async function deleteMessage(formData: FormData) {
  const operator = await requireWriter();
  const messageId = str(formData, "messageId");
  const assetId = str(formData, "assetId");
  if (!messageId) return;
  await prisma.notifyMessage.updateMany({
    where: { id: messageId, operatorId: operator.id, status: { in: ["queued", "failed"] } },
    data: { status: "cancelled", cancelReason: "owner", cancelledAt: new Date() },
  });
  if (assetId) refresh(assetId);
  revalidatePath("/alerts");
}

/** Undo deleteMessage: the message waits to be sent again. */
export async function restoreMessage(formData: FormData) {
  const operator = await requireWriter();
  const messageId = str(formData, "messageId");
  const assetId = str(formData, "assetId");
  if (!messageId) return;
  await prisma.notifyMessage.updateMany({
    where: { id: messageId, operatorId: operator.id, status: "cancelled", cancelReason: "owner" },
    data: { status: "queued", cancelReason: null, cancelledAt: null, error: null },
  });
  if (assetId) refresh(assetId);
  revalidatePath("/alerts");
}

/** Retry automatic delivery (no-op without Cloud API credentials). */
export async function retryOutbox(formData: FormData) {
  const operator = await requireWriter();
  const assetId = str(formData, "assetId");
  await prisma.notifyMessage.updateMany({
    where: { operatorId: operator.id, status: "failed" },
    data: { status: "queued", error: null },
  });
  await flushOutbox(operator.id).catch(() => undefined);
  if (assetId) refresh(assetId);
  else revalidatePath("/alerts");
}

// ── Daily lets: one answer per day ─────────────────────────────────────

/**
 * Record whether a daily-let asset was rented on a given day, and for how
 * much. The tariff only suggests the figure — whatever was actually agreed
 * is what gets stored, and it stays editable afterwards.
 *
 * ONE record per day of a daily let: this DayEntry is what the dashboard's
 * "rented today?" writes AND what nights marked on the asset's calendar
 * write (saveDayRange below). Every calendar, the analytics and the income
 * totals read it through lib/property/stays.ts, where it only fills a
 * night no booking, lease or contract holds — so a night is never counted
 * twice. (A night a stay already holds is not asked about: DailyCheck
 * shows that stay instead.)
 */
export async function saveDayEntry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const assetId = str(formData, "assetId");
  const dateRaw = str(formData, "date");
  if (!assetId || !dateRaw) return { error: "error_required" };

  const owned = await ownAsset(assetId);
  if (!owned) return { error: "error_required" };

  const rented = str(formData, "rented") === "1";
  const amountRaw = optionalNumber(formData, "amount");
  if (Number.isNaN(amountRaw) || (amountRaw != null && amountRaw < 0)) {
    return { error: "error_invalid_number" };
  }
  const amount = rented ? amountRaw ?? 0 : 0;
  const date = new Date(`${dateRaw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return { error: "error_required" };

  await prisma.dayEntry.upsert({
    where: { assetId_date: { assetId, date } },
    update: { rented, amount, note: str(formData, "note") || null },
    create: {
      assetId,
      date,
      rented,
      amount,
      currency: owned.asset.currency,
      note: str(formData, "note") || null,
    },
  });

  revalidatePath("/");
  // The answer is a night on the Rentals calendar and in its analytics too.
  revalidatePath("/calendar");
  revalidatePath("/analytics");
  refresh(assetId);
  return { ok: true };
}

/**
 * Mark a stretch of nights on a day-let asset's own calendar (the asset
 * page). ONE record for a daily let's day: this writes the same DayEntry
 * rows as the dashboard's "rented today?" — the calendar is that question
 * answered for several days at once — so the two never disagree, the
 * dashboard does not ask again about a marked day, and every calendar,
 * analytics figure and income total reads them the same way
 * (lib/property/stays.ts). "Rented" skips nights a booking, lease or
 * contract already holds; the amount is per night, as agreed. A long-term
 * asset's calendar still records a contract (saveContract).
 */
export async function saveDayRange(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const assetId = str(formData, "assetId");
  const startRaw = str(formData, "startDate");
  const endRaw = str(formData, "endDate");
  if (!assetId || !startRaw || !endRaw) return { error: "error_required" };

  const start = new Date(`${startRaw}T00:00:00Z`);
  const end = new Date(`${endRaw}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "error_required" };
  }
  if (end <= start || (end.getTime() - start.getTime()) / 86_400_000 > MAX_MARKED_NIGHTS) {
    return { error: "error_dates" };
  }

  const rented = str(formData, "rented") !== "0";
  const amountRaw = optionalNumber(formData, "amount");
  if (Number.isNaN(amountRaw) || (amountRaw != null && amountRaw < 0)) {
    return { error: "error_invalid_number" };
  }
  if (rented && amountRaw == null) return { error: "error_required" };

  const owned = await ownAsset(assetId);
  if (!owned || owned.asset.rentalMode !== "daily") return { error: "error_required" };

  const sources = (
    await loadAssetSources(owned.operator.id, [assetId], { start, end })
  ).get(assetId);
  if (!sources) return { error: "error_required" };
  const nights = nightsToAnswer(sources, start, end, rented);
  if (nights.length === 0) return { error: "error_days_taken" };
  // "Not rented" cannot free a night a booking, lease or contract holds:
  // that stay is the record of it. Say so instead of a silent "saved".
  const held = rented ? 0 : nightsHeld(sources, start, end);

  const amount = rented ? amountRaw ?? 0 : 0;
  const note = str(formData, "tenantName") || str(formData, "note") || null;
  await prisma.$transaction(
    nights.map((date) =>
      prisma.dayEntry.upsert({
        where: { assetId_date: { assetId, date } },
        update: { rented, amount, note },
        create: { assetId, date, rented, amount, currency: owned.asset.currency, note },
      }),
    ),
  );

  refresh(assetId);
  revalidatePath("/calendar");
  revalidatePath("/analytics");
  return held > 0 ? { ok: true, notice: "notice_days_held" } : { ok: true };
}
