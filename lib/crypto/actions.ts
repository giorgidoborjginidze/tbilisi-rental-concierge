"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth/session";
import { COINS } from "@/lib/crypto/prices";
import type { FormState } from "@/lib/units/actions";
import type { StringKey } from "@/lib/i18n/strings";
import { submittedValues } from "@/lib/forms";
import { parseTradeInput } from "@/lib/assets/trade-input";
import { startOfTodayTbilisi } from "@/lib/time";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// Create a crypto holding (an Asset with category "crypto"). The user
// picks a known coin (symbol → CoinGecko id) or types a custom one.
export async function createCrypto(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireWriter();
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

// Record a buy or sell on a holding (coin, share or precious metal). A
// metal may be typed in grams; it is stored in troy ounces
// (lib/assets/trade-input.ts). An error hands back what was typed.
export async function addTrade(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireWriter();
  const fail = (error: StringKey): FormState => ({ error, values: submittedValues(formData) });
  const assetId = str(formData, "assetId");
  if (!assetId) return fail("error_required");

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, operatorId: operator.id, category: { in: ["crypto", "stock", "metal"] } },
  });
  if (!asset) return fail("error_required");

  const parsed = parseTradeInput((key) => str(formData, key), {
    metal: asset.category === "metal",
    today: startOfTodayTbilisi(),
  });
  if ("error" in parsed) return fail(parsed.error);
  const trade = parsed.value!;

  await prisma.cryptoTrade.create({
    data: {
      assetId,
      side: trade.side,
      quantity: trade.quantity,
      unitPrice: trade.unitPrice,
      tradedAt: trade.tradedAt,
    },
  });
  revalidatePath("/assets");
  revalidatePath("/");
  revalidatePath(`/assets/${assetId}/edit`);
  return { ok: true };
}

export async function deleteTrade(formData: FormData) {
  const operator = await requireWriter();
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
