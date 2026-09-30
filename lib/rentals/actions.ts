"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import type { FormState } from "@/lib/units/actions";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/notify/templates";
import { flushOutbox } from "@/lib/notify/whatsapp";
import { parsePolygon } from "@/lib/geo/fence";
import { startOfTodayTbilisi } from "@/lib/time";
import { PAYMENT_PERIODS, snapToBoundary, type PaymentPeriod } from "./schedule";
import { monthlyEquivalent } from "./amount";
import { alignPaidThrough, applyPayment, replayLedger } from "./ledger";
import { contractTerms, periodAmount } from "./terms";
import { settlePaidRent } from "./settle";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

const optionalNumber = (formData: FormData, key: string): number | null => {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
};

/** Confirm the asset belongs to the signed-in workspace. */
async function ownAsset(assetId: string) {
  const operator = await requireOperator();
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
    where: { id: contractId, assetId },
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

  if (stated && stated.getTime() !== contract.paidThrough?.getTime()) {
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
    where: { id: contractId, assetId },
    data: {
      paymentPeriod: period,
      paymentAmount: amount,
      monthlyRent: next.monthlyRent,
      graceDays: Math.round(graceRaw),
      remindersEnabled,
      ...(ledger ?? {}),
    },
  });
  if (ledger) await settlePaidRent(prisma, contractId, ledger.paidThrough);

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
  const contractId = str(formData, "contractId");
  const assetId = str(formData, "assetId");
  const amount = Number(str(formData, "amount"));
  if (!contractId || !assetId) return { error: "error_required" };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "error_invalid_number" };

  const owned = await ownAsset(assetId);
  if (!owned) return { error: "error_required" };

  const contract = await prisma.rentalContract.findFirst({
    where: { id: contractId, assetId },
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

  await prisma.$transaction([
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
  await settlePaidRent(prisma, contractId, step.state.paidThrough);

  refresh(assetId);
  return null;
}

/**
 * Delete a payment and rebuild the schedule from the ledger's opening
 * balance and the payments that remain, so a period paid by a later
 * payment never re-opens. Payments from before the balance was last
 * restated are part of that statement and are not deleted here.
 */
export async function deletePayment(formData: FormData) {
  const assetId = str(formData, "assetId");
  const paymentId = str(formData, "paymentId");
  const owned = assetId ? await ownAsset(assetId) : null;
  if (!owned || !paymentId) return;

  const payment = await prisma.rentPayment.findFirst({
    where: { id: paymentId, contract: { assetId } },
    include: { contract: true },
  });
  if (!payment) return;
  const contract = payment.contract;
  if (contract.openingAt && payment.createdAt <= contract.openingAt) return;

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
  refresh(assetId);
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
  refresh(assetId);
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
    return { error: "error_invalid_number" };
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
      radiusKm == null || Number.isNaN(radiusKm) || radiusKm <= 0
    ) {
      return { error: "error_invalid_number" };
    }
    if (centerLat < -90 || centerLat > 90 || centerLng < -180 || centerLng > 180) {
      return { error: "error_invalid_number" };
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
  await prisma.geofence.update({
    where: { id: fenceId },
    data: { active: !fence.active },
  });
  refresh(assetId);
}

export async function deleteGeofence(formData: FormData) {
  const assetId = str(formData, "assetId");
  const fenceId = str(formData, "fenceId");
  const owned = assetId ? await ownAsset(assetId) : null;
  if (!owned || !fenceId) return;
  await prisma.geofence.deleteMany({ where: { id: fenceId, assetId } });
  refresh(assetId);
}

// ── Notification setup ──────────────────────────────────────────────────

export async function saveNotifySetup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireOperator();
  const assetId = str(formData, "assetId");

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
  const operator = await requireOperator();
  const messageId = str(formData, "messageId");
  const assetId = str(formData, "assetId");
  if (!messageId) return;
  await prisma.notifyMessage.updateMany({
    where: { id: messageId, operatorId: operator.id },
    data: { status: "sent", sentAt: new Date(), error: null },
  });
  if (assetId) refresh(assetId);
}

export async function deleteMessage(formData: FormData) {
  const operator = await requireOperator();
  const messageId = str(formData, "messageId");
  const assetId = str(formData, "assetId");
  if (!messageId) return;
  await prisma.notifyMessage.deleteMany({
    where: { id: messageId, operatorId: operator.id },
  });
  if (assetId) refresh(assetId);
}

/** Retry automatic delivery (no-op without Cloud API credentials). */
export async function retryOutbox(formData: FormData) {
  const operator = await requireOperator();
  const assetId = str(formData, "assetId");
  await prisma.notifyMessage.updateMany({
    where: { operatorId: operator.id, status: "failed" },
    data: { status: "queued", error: null },
  });
  await flushOutbox(operator.id).catch(() => undefined);
  if (assetId) refresh(assetId);
}

// ── Daily lets: one answer per day ─────────────────────────────────────

/**
 * Record whether a daily-let asset was rented on a given day, and for how
 * much. The tariff only suggests the figure — whatever was actually agreed
 * is what gets stored, and it stays editable afterwards.
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
  refresh(assetId);
  return { ok: true };
}

export async function deleteDayEntry(formData: FormData) {
  const assetId = str(formData, "assetId");
  const dateRaw = str(formData, "date");
  const owned = assetId ? await ownAsset(assetId) : null;
  if (!owned || !dateRaw) return;
  await prisma.dayEntry.deleteMany({
    where: { assetId, date: new Date(`${dateRaw}T00:00:00Z`) },
  });
  revalidatePath("/");
  refresh(assetId);
}
