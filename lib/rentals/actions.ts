"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import type { FormState } from "@/lib/units/actions";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/notify/templates";
import { flushOutbox } from "@/lib/notify/whatsapp";
import { parsePolygon } from "@/lib/geo/fence";
import {
  PAYMENT_PERIODS,
  advancePaidThrough,
  periodsCovered,
  type PaymentPeriod,
} from "./schedule";
import { periodAmount } from "./monitor";

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
  revalidatePath("/alerts");
};

// ── Payment schedule ────────────────────────────────────────────────────

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
  if (Number.isNaN(amount) || (amount != null && amount <= 0)) {
    return { error: "error_invalid_number" };
  }
  const graceRaw = optionalNumber(formData, "graceDays");
  if (Number.isNaN(graceRaw) || graceRaw == null || graceRaw < 0 || graceRaw > 60) {
    return { error: "error_invalid_number" };
  }

  const paidThroughRaw = str(formData, "paidThrough");

  await prisma.rentalContract.updateMany({
    where: { id: contractId, assetId },
    data: {
      paymentPeriod: period,
      paymentAmount: amount,
      graceDays: Math.round(graceRaw),
      ...(paidThroughRaw
        ? { paidThrough: new Date(`${paidThroughRaw}T00:00:00Z`) }
        : {}),
    },
  });

  refresh(assetId);
  return null;
}

/**
 * Record money received. The schedule moves forward by whole periods only,
 * so a part payment leaves the contract exactly as late as it was — which
 * is the honest answer.
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

  const period = (contract.paymentPeriod as PaymentPeriod) ?? "monthly";
  const perPeriod = periodAmount(contract);
  const covered = Math.max(1, periodsCovered(amount, perPeriod));
  const periodStart = contract.paidThrough ?? contract.startDate;
  const periodEnd = advancePaidThrough(
    contract.paidThrough,
    contract.startDate,
    period,
    covered,
  );

  const paidAtRaw = str(formData, "paidAt");

  await prisma.$transaction([
    prisma.rentPayment.create({
      data: {
        contractId,
        amount,
        currency: contract.currency,
        paidAt: paidAtRaw ? new Date(`${paidAtRaw}T00:00:00Z`) : new Date(),
        periodStart,
        periodEnd,
        method: str(formData, "method") || "cash",
        note: str(formData, "note") || null,
      },
    }),
    prisma.rentalContract.update({
      where: { id: contractId },
      data: { paidThrough: periodEnd },
    }),
  ]);

  refresh(assetId);
  return null;
}

export async function deletePayment(formData: FormData) {
  const assetId = str(formData, "assetId");
  const paymentId = str(formData, "paymentId");
  const owned = assetId ? await ownAsset(assetId) : null;
  if (!owned || !paymentId) return;

  const payment = await prisma.rentPayment.findFirst({
    where: { id: paymentId, contract: { assetId } },
  });
  if (!payment) return;

  // Roll the schedule back to where this payment started.
  await prisma.$transaction([
    prisma.rentPayment.delete({ where: { id: paymentId } }),
    prisma.rentalContract.update({
      where: { id: payment.contractId },
      data: { paidThrough: payment.periodStart },
    }),
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
  // clearing a field restores the built-in wording.
  for (const key of TEMPLATE_KEYS) {
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
