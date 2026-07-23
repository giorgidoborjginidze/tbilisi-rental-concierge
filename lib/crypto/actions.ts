"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { COINS } from "@/lib/crypto/prices";
import type { FormState } from "@/lib/units/actions";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(str(fd, k));

// Create a crypto holding (an Asset with category "crypto"). The user
// picks a known coin (symbol → CoinGecko id) or types a custom one.
export async function createCrypto(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireOperator();
  const symbolRaw = str(formData, "symbol").toUpperCase();
  if (!symbolRaw) return { error: "error_required" };

  const known = COINS[symbolRaw];
  const coingeckoId = known?.id || str(formData, "coingeckoId").toLowerCase() || null;
  const name = known?.name || str(formData, "name") || symbolRaw;

  const { getBillingContext } = await import("@/lib/billing/context");
  if (!(await getBillingContext(operator)).canAddAsset) {
    return { error: "error_limit_assets" };
  }

  const asset = await prisma.asset.create({
    data: {
      operatorId: operator.id,
      name,
      category: "crypto",
      type: "coin",
      symbol: symbolRaw,
      coingeckoId,
      currency: "USD",
      status: "personal_use",
    },
  });
  revalidatePath("/assets");
  redirect(`/assets/${asset.id}/edit`);
}

// Record a buy or sell on a crypto asset.
export async function addTrade(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireOperator();
  const assetId = str(formData, "assetId");
  const side = str(formData, "side") === "sell" ? "sell" : "buy";
  const quantity = num(formData, "quantity");
  const unitPrice = num(formData, "unitPrice");
  const dateRaw = str(formData, "tradedAt");

  if (!assetId) return { error: "error_required" };
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "error_invalid_number" };
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "error_invalid_number" };

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, operatorId: operator.id, category: { in: ["crypto", "stock", "metal"] } },
  });
  if (!asset) return { error: "error_required" };

  await prisma.cryptoTrade.create({
    data: {
      assetId,
      side,
      quantity,
      unitPrice,
      tradedAt: dateRaw ? new Date(`${dateRaw}T00:00:00Z`) : new Date(),
    },
  });
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}/edit`);
  return null;
}

export async function deleteTrade(formData: FormData) {
  const operator = await requireOperator();
  const tradeId = str(formData, "tradeId");
  const assetId = str(formData, "assetId");
  if (tradeId) {
    await prisma.cryptoTrade.deleteMany({
      where: { id: tradeId, asset: { operatorId: operator.id } },
    });
    revalidatePath("/assets");
    if (assetId) revalidatePath(`/assets/${assetId}/edit`);
  }
}
