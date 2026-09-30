"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth/session";
import type { FormState } from "@/lib/units/actions";
import type { StringKey } from "@/lib/i18n/strings";
import { submittedValues } from "@/lib/forms";
import { parseTradeInput } from "@/lib/assets/trade-input";
import { startOfTodayTbilisi } from "@/lib/time";
import { removalShortfall, sellShortfall, type CryptoTradeLike } from "@/lib/crypto/holdings";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { formatQuantity } from "@/lib/format";

const TRADE_FIELDS = { id: true, side: true, quantity: true, unitPrice: true, tradedAt: true, createdAt: true } as const;
const asTrade = (row: { side: string; quantity: number; unitPrice: number; tradedAt: Date; createdAt: Date }): CryptoTradeLike => ({
  side: row.side === "sell" ? "sell" : "buy",
  quantity: row.quantity,
  unitPrice: row.unitPrice,
  tradedAt: row.tradedAt,
  createdAt: row.createdAt,
});

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

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

  // Average cost only makes sense for what was actually held: a sell may
  // not exceed the quantity held on its date — nor leave a later sell
  // without cover.
  if (trade.side === "sell") {
    const existing = await prisma.cryptoTrade.findMany({ where: { assetId }, select: TRADE_FIELDS });
    const short = sellShortfall(existing.map(asTrade), trade);
    if (short) {
      const locale = await getLocale();
      const metal = asset.category === "metal";
      const held = formatQuantity(short.held, asset.category);
      const unit = metal ? t(locale, "metal_unit_oz") : asset.symbol ?? "";
      return {
        error: "error_sell_exceeds",
        detail: `${held} ${unit}`.trim() + ".",
        values: submittedValues(formData),
      };
    }
  }

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
  if (!tradeId) return;
  const trade = await prisma.cryptoTrade.findFirst({
    where: { id: tradeId, asset: { operatorId: operator.id } },
    select: { assetId: true },
  });
  if (!trade) return;

  // A buy that a later sell depends on stays: deleting it would leave
  // that sell selling what was never held. The page says so.
  const trades = await prisma.cryptoTrade.findMany({ where: { assetId: trade.assetId }, select: TRADE_FIELDS });
  const index = trades.findIndex((row) => row.id === tradeId);
  if (index >= 0 && removalShortfall(trades.map(asTrade), index)) {
    redirect(`/assets/${trade.assetId}/edit?trade=blocked#trades`);
  }

  await prisma.cryptoTrade.delete({ where: { id: tradeId } });
  revalidatePath("/assets");
  revalidatePath("/");
  revalidatePath(`/assets/${assetId || trade.assetId}/edit`);
}
