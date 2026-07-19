"use server";

import { randomInt } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { ASSET_CATEGORIES, ASSET_STATUSES } from "@/lib/types";
import type { FormState } from "@/lib/units/actions";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

const optionalNumber = (formData: FormData, key: string): number | null => {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
};

export async function saveAsset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireOperator();

  const assetId = str(formData, "assetId") || null;
  const name = str(formData, "name");
  const category = str(formData, "category");
  const type = str(formData, "type");
  const status = str(formData, "status");

  if (!name) return { error: "error_required" };
  if (!(ASSET_CATEGORIES as readonly string[]).includes(category)) {
    return { error: "error_required" };
  }
  if (!(ASSET_STATUSES as readonly string[]).includes(status)) {
    return { error: "error_required" };
  }

  const areaSqm = optionalNumber(formData, "areaSqm");
  const estimatedValue = optionalNumber(formData, "estimatedValue");
  if (Number.isNaN(areaSqm) || Number.isNaN(estimatedValue)) {
    return { error: "error_invalid_number" };
  }

  const unitId = str(formData, "unitId") || null;
  const data = {
    name,
    nameKa: str(formData, "nameKa") || null,
    category,
    type: type || "other",
    city: str(formData, "city") || null,
    district: str(formData, "district") || null,
    address: str(formData, "address") || null,
    areaSqm,
    estimatedValue,
    currency: str(formData, "currency") || "GEL",
    status,
    unitId,
    rentalMode: str(formData, "rentalMode") === "daily" ? "daily" : "long_term",
    myhomeUrl: str(formData, "myhomeUrl") || null,
    ssUrl: str(formData, "ssUrl") || null,
    myautoUrl: str(formData, "myautoUrl") || null,
    airbnbUrl: str(formData, "airbnbUrl") || null,
    bookingUrl: str(formData, "bookingUrl") || null,
    notes: str(formData, "notes") || null,
  };

  if (assetId) {
    const owned = await prisma.asset.findFirst({
      where: { id: assetId, operatorId: operator.id },
    });
    if (!owned) return { error: "error_required" };
    await prisma.asset.update({ where: { id: assetId }, data });
  } else {
    await prisma.asset.create({ data: { ...data, operatorId: operator.id } });
  }

  revalidatePath("/assets");
  redirect("/assets");
}

// Generate a fresh 6-digit door code for an asset (daily rentals /
// tenant handovers); sent to the tenant via a WhatsApp deep link.
export async function generateDoorCode(formData: FormData) {
  const operator = await requireOperator();
  const assetId = str(formData, "assetId");
  if (assetId) {
    await prisma.asset.updateMany({
      where: { id: assetId, operatorId: operator.id },
      data: {
        doorCode: String(randomInt(0, 1_000_000)).padStart(6, "0"),
        doorCodeGeneratedAt: new Date(),
      },
    });
    revalidatePath("/assets");
  }
}

// Quick status flip used by the per-asset listing buttons (rented/vacant).
export async function setAssetStatus(formData: FormData) {
  const operator = await requireOperator();
  const assetId = str(formData, "assetId");
  const status = str(formData, "status");
  if (assetId && (status === "rented" || status === "vacant")) {
    await prisma.asset.updateMany({
      where: { id: assetId, operatorId: operator.id },
      data: { status },
    });
    revalidatePath("/assets");
  }
}

export async function deleteAsset(formData: FormData) {
  const operator = await requireOperator();
  const assetId = str(formData, "assetId");
  if (assetId) {
    await prisma.asset.deleteMany({
      where: { id: assetId, operatorId: operator.id },
    });
    revalidatePath("/assets");
  }
  redirect("/assets");
}

export async function saveContract(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const assetId = str(formData, "assetId");
  const startRaw = str(formData, "startDate");
  const endRaw = str(formData, "endDate");
  const monthlyRent = Number(str(formData, "monthlyRent"));

  if (!assetId || !startRaw || !endRaw) return { error: "error_required" };
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
    return { error: "error_invalid_number" };
  }

  const startDate = new Date(`${startRaw}T00:00:00Z`);
  const endDate = new Date(`${endRaw}T00:00:00Z`);
  if (endDate <= startDate) return { error: "error_dates" };

  const deposit = optionalNumber(formData, "deposit");
  if (Number.isNaN(deposit)) return { error: "error_invalid_number" };

  const operator = await requireOperator();
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, operatorId: operator.id },
  });
  if (!asset) return { error: "error_required" };

  const now = new Date();
  const status = endDate < now ? "ended" : startDate > now ? "upcoming" : "active";

  await prisma.rentalContract.create({
    data: {
      assetId,
      tenantName: str(formData, "tenantName") || null,
      tenantPhone: str(formData, "tenantPhone") || null,
      startDate,
      endDate,
      monthlyRent,
      deposit,
      currency: asset.currency,
      status,
      notes: str(formData, "notes") || null,
    },
  });

  // An active contract means the asset is rented.
  if (status === "active" && asset.status !== "rented") {
    await prisma.asset.update({
      where: { id: assetId },
      data: { status: "rented" },
    });
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}/edit`);
  return null;
}

export async function deleteContract(formData: FormData) {
  const operator = await requireOperator();
  const contractId = str(formData, "contractId");
  const assetId = str(formData, "assetId");
  if (contractId) {
    await prisma.rentalContract.deleteMany({
      where: { id: contractId, asset: { operatorId: operator.id } },
    });
    revalidatePath("/assets");
    if (assetId) revalidatePath(`/assets/${assetId}/edit`);
  }
}

export async function addIncome(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireOperator();

  const dateRaw = str(formData, "date");
  const amount = Number(str(formData, "amount"));
  if (!dateRaw) return { error: "error_required" };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "error_invalid_number" };
  }

  await prisma.incomeRecord.create({
    data: {
      operatorId: operator.id,
      source: str(formData, "source") || "other",
      description: str(formData, "description") || null,
      date: new Date(`${dateRaw}T00:00:00Z`),
      amount,
      currency: "GEL",
      assetId: str(formData, "incomeAssetId") || null,
    },
  });

  revalidatePath("/assets");
  return null;
}

export async function deleteIncome(formData: FormData) {
  const operator = await requireOperator();
  const incomeId = str(formData, "incomeId");
  if (incomeId) {
    await prisma.incomeRecord.deleteMany({
      where: { id: incomeId, operatorId: operator.id },
    });
    revalidatePath("/assets");
  }
}
