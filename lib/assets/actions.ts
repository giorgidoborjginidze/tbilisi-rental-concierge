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
import { startOfTodayTbilisi } from "@/lib/time";
import { asPeriod, monthlyEquivalent } from "@/lib/rentals/amount";
import { contractPhase } from "@/lib/rentals/phase";
import { settlePaidRent, withdrawContract } from "@/lib/rentals/settle";
import { defaultPaidThrough, snapToBoundary } from "@/lib/rentals/schedule";

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
    await prisma.asset.update({
      where: { id: assetId },
      // A status the owner changes by hand is stamped, so it outranks a
      // stale "rented" left behind by a finished contract.
      data: { ...data, ...(owned.status !== status ? { statusSetAt: new Date() } : {}) },
    });
    // Daily contracts are priced day by day with the asset's weekend and
    // holiday premiums. New premiums must not re-price money already
    // received: each tracked daily contract opens a new ledger balance at
    // its current position, so a later delete replays only payments made
    // under the new prices (as a change of terms does in saveSchedule).
    const premiumsChanged =
      (owned.weekendPct ?? 0) !== (weekendPct ?? 0) ||
      (owned.holidayPct ?? 0) !== (holidayPct ?? 0);
    if (premiumsChanged) {
      const daily = await prisma.rentalContract.findMany({
        where: { assetId, paymentPeriod: "daily", paidThrough: { not: null } },
        select: { id: true, paidThrough: true, creditBalance: true },
      });
      const openedAt = new Date();
      for (const contract of daily) {
        await prisma.rentalContract.update({
          where: { id: contract.id },
          data: {
            openingPaidThrough: contract.paidThrough,
            openingCredit: contract.creditBalance,
            openingAt: openedAt,
          },
        });
        // Reminders still waiting quote the old day prices.
        await settlePaidRent(prisma, contract.id, contract.paidThrough, openedAt, {
          cause: "changed",
          withdrawOwed: true,
        });
      }
    }
  } else {
    const { getBillingContext } = await import("@/lib/billing/context");
    if (!(await getBillingContext(operator)).canAddAsset) {
      return { error: "error_limit_assets" };
    }
    await prisma.asset.create({
      data: { ...data, operatorId: operator.id, statusSetAt: new Date() },
    });
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
      data: { status, statusSetAt: new Date() },
    });
    revalidatePath("/assets");
    revalidatePath("/");
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

/**
 * Add a rental contract. The owner types the rent PER PAYMENT PERIOD
 * (60 a day, 350 a week, 1,200 a month); that is what the schedule
 * charges, and monthlyRent keeps its monthly equivalent for every monthly
 * figure. "Paid up to" says how far the rent is already paid, so a lease
 * that has been running since March is not announced as seven months late
 * the moment it is typed in.
 */
export async function saveContract(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const assetId = str(formData, "assetId");
  const startRaw = str(formData, "startDate");
  const endRaw = str(formData, "endDate");
  // "amount" is the per-period rent; older clients posted "monthlyRent".
  const amount = Number(str(formData, "amount") || str(formData, "monthlyRent"));

  if (!assetId || !startRaw || !endRaw) return { error: "error_required" };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "error_invalid_number" };
  }

  const startDate = new Date(`${startRaw}T00:00:00Z`);
  const endDate = new Date(`${endRaw}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: "error_required" };
  }
  if (endDate <= startDate) return { error: "error_dates" };

  const deposit = optionalNumber(formData, "deposit");
  if (Number.isNaN(deposit)) return { error: "error_invalid_number" };

  const operator = await requireOperator();
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, operatorId: operator.id },
  });
  if (!asset) return { error: "error_required" };

  // Payment terms: how often rent is collected and how many days late the
  // contract tolerates before the owner may act.
  const paymentPeriod = asPeriod(str(formData, "paymentPeriod"));
  const graceRaw = Number(str(formData, "graceDays"));
  const graceDays =
    Number.isFinite(graceRaw) && graceRaw >= 0 && graceRaw <= 60
      ? Math.round(graceRaw)
      : 3;

  // Paid up to: the typed date moved onto the contract's due dates, or —
  // when nothing is typed — the first due date on or after today, so a
  // running lease starts in good standing.
  const today = startOfTodayTbilisi();
  const paidRaw = str(formData, "paidThrough");
  let paidThrough: Date;
  if (paidRaw) {
    const typed = new Date(`${paidRaw}T00:00:00Z`);
    if (Number.isNaN(typed.getTime())) return { error: "error_required" };
    paidThrough = snapToBoundary(startDate, endDate, paymentPeriod, typed);
  } else {
    paidThrough = defaultPaidThrough(startDate, endDate, paymentPeriod, today);
  }

  // The checkbox is only on the full contract form; the calendar's quick
  // form leaves reminders on.
  const remindersEnabled = formData.has("remindersField")
    ? formData.get("remindersEnabled") === "on"
    : true;

  // Stored for compatibility only — every reader derives it from dates.
  const phase = contractPhase({ startDate, endDate }, today);

  await prisma.rentalContract.create({
    data: {
      assetId,
      tenantName: str(formData, "tenantName") || null,
      tenantPhone: str(formData, "tenantPhone") || null,
      startDate,
      endDate,
      paymentAmount: amount,
      monthlyRent: monthlyEquivalent(amount, paymentPeriod),
      deposit,
      currency: asset.currency,
      status: phase,
      paymentPeriod,
      graceDays,
      paidThrough,
      creditBalance: 0,
      remindersEnabled,
      // The ledger's opening balance: payments recorded from now on are
      // replayed on top of it if one of them is ever deleted.
      openingPaidThrough: paidThrough,
      openingCredit: 0,
      openingAt: new Date(),
      notes: str(formData, "notes") || null,
    },
  });

  // A running contract means the asset is rented.
  if (phase === "active" && asset.status !== "rented") {
    await prisma.asset.update({
      where: { id: assetId },
      data: { status: "rented" },
    });
  }

  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}/edit`);
  revalidatePath(`/assets/${assetId}/rental`);
  return null;
}

export async function deleteContract(formData: FormData) {
  const operator = await requireOperator();
  const contractId = str(formData, "contractId");
  const assetId = str(formData, "assetId");
  if (contractId) {
    const { count } = await prisma.rentalContract.deleteMany({
      where: { id: contractId, asset: { operatorId: operator.id } },
    });
    // Nothing more may go out about a contract that no longer exists, and
    // its alerts (late rent, repossession right, expiry) are closed.
    if (count > 0) await withdrawContract(prisma, contractId, "contract_deleted");
    revalidatePath("/assets");
    revalidatePath("/alerts");
    revalidatePath("/");
    if (assetId) {
      revalidatePath(`/assets/${assetId}/edit`);
      revalidatePath(`/assets/${assetId}/rental`);
    }
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
