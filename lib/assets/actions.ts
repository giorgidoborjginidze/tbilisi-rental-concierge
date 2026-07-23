"use server";

import { randomInt } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { ASSET_CATEGORIES, ASSET_STATUSES } from "@/lib/types";
import { COINS } from "@/lib/crypto/prices";
import { POPULAR_STOCKS } from "@/lib/stocks/prices";
import { METALS } from "@/lib/metals/prices";
import type { FormState } from "@/lib/units/actions";
import type { SessionOperator } from "@/lib/auth/session";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

// Categories tracked as holdings (quantity + buy price + live value) rather
// than the generic property/income form. Created here, then the buyer lands
// on the asset's edit page to log buys and sells.
const HOLDING_CATEGORIES = ["crypto", "stock", "metal"] as const;

async function createHolding(
  operator: SessionOperator,
  category: "crypto" | "stock" | "metal",
  formData: FormData,
): Promise<FormState> {
  const symbol = str(formData, "symbol").toUpperCase();
  if (!symbol) return { error: "error_required" };

  const { getBillingContext } = await import("@/lib/billing/context");
  if (!(await getBillingContext(operator)).canAddAsset) {
    return { error: "error_limit_assets" };
  }

  let name: string;
  let type: string;
  let coingeckoId: string | null = null;

  if (category === "crypto") {
    const known = COINS[symbol];
    coingeckoId = known?.id || str(formData, "coingeckoId").toLowerCase() || null;
    name = known?.name || str(formData, "name") || symbol;
    type = "coin";
  } else if (category === "stock") {
    name = POPULAR_STOCKS[symbol] || str(formData, "name") || symbol;
    type = "share";
  } else {
    name = METALS[symbol]?.name || str(formData, "name") || symbol;
    type = METALS[symbol]?.type || "gold";
  }

  const asset = await prisma.asset.create({
    data: {
      operatorId: operator.id,
      name,
      category,
      type,
      symbol,
      coingeckoId,
      currency: "USD",
      status: "personal_use",
    },
  });
  revalidatePath("/assets");
  redirect(`/assets/${asset.id}/edit`);
}

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

  if (!(ASSET_CATEGORIES as readonly string[]).includes(category)) {
    return { error: "error_required" };
  }

  // New crypto/stock/metal go through the holdings path (redirects on success).
  if (
    !assetId &&
    (HOLDING_CATEGORIES as readonly string[]).includes(category)
  ) {
    return createHolding(
      operator,
      category as "crypto" | "stock" | "metal",
      formData,
    );
  }

  if (!name) return { error: "error_required" };
  if (!(ASSET_STATUSES as readonly string[]).includes(status)) {
    return { error: "error_required" };
  }

  const areaSqm = optionalNumber(formData, "areaSqm");
  const estimatedValue = optionalNumber(formData, "estimatedValue");
  const monthlyIncome = optionalNumber(formData, "monthlyIncome");
  const dailyRate = optionalNumber(formData, "dailyRate");
  const weekendPct = optionalNumber(formData, "weekendPct");
  const holidayPct = optionalNumber(formData, "holidayPct");
  if (
    Number.isNaN(areaSqm) ||
    Number.isNaN(estimatedValue) ||
    Number.isNaN(monthlyIncome) ||
    Number.isNaN(dailyRate) ||
    Number.isNaN(weekendPct) ||
    Number.isNaN(holidayPct)
  ) {
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
    monthlyIncome,
    currency: str(formData, "currency") || "GEL",
    status,
    unitId,
    rentalMode: str(formData, "rentalMode") === "daily" ? "daily" : "long_term",
    dailyRate,
    weekendPct,
    holidayPct,
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
    const { getBillingContext } = await import("@/lib/billing/context");
    if (!(await getBillingContext(operator)).canAddAsset) {
      return { error: "error_limit_assets" };
    }
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
