"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth/session";
import type { FormState } from "@/lib/units/actions";
import type { StringKey } from "@/lib/i18n/strings";
import { submittedValues } from "@/lib/forms";
import { parseTradeInput, toUsdTrade } from "@/lib/assets/trade-input";
import { usdGelOn } from "@/lib/prices/usd-gel-on";
import { tbilisiFormat, startOfTodayTbilisi } from "@/lib/time";
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
  // Bought in lari: stored in USD at the NBG rate of that day.
  const trade = toUsdTrade(
    parsed.value!,
    parsed.value!.priceCurrency === "GEL" ? (await usdGelOn(parsed.value!.tradedAt))?.rate ?? null : null,
  );
  if (!trade) return fail("error_rate_unavailable");

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
      if (short.later) {
        // It fits on its own date but uncovers a later sale: say which.
        const at = short.later.tradedAt ? new Date(short.later.tradedAt as string | number | Date) : null;
        return {
          error: "error_sell_uncovers_later",
          detail: [
            at ? tbilisiFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(at) : null,
            `${formatQuantity(short.later.quantity, asset.category)} ${unit}`.trim(),
          ]
            .filter(Boolean)
            .join(" · ") + ".",
          values: submittedValues(formData),
        };
      }
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
  if (!tradeId) return null;
  const trade = await prisma.cryptoTrade.findFirst({
    where: { id: tradeId, asset: { operatorId: operator.id } },
    select: { assetId: true },
  });
  if (!trade) return null;

  // A buy that a later sell depends on stays: deleting it would leave
  // that sell selling what was never held. The page says so.
  const trades = await prisma.cryptoTrade.findMany({ where: { assetId: trade.assetId }, select: TRADE_FIELDS });
  const index = trades.findIndex((row) => row.id === tradeId);
  if (index >= 0 && removalShortfall(trades.map(asTrade), index)) {
    redirect(`/assets/${trade.assetId}/edit?trade=blocked#trades`);
  }

  const gone = await prisma.cryptoTrade.delete({ where: { id: tradeId } });
  revalidatePath("/assets");
  revalidatePath("/");
  revalidatePath(`/assets/${assetId || trade.assetId}/edit`);
  // What the undo puts back.
  return {
    undo: {
      assetId: gone.assetId,
      side: gone.side,
      quantity: String(gone.quantity),
      unitPrice: String(gone.unitPrice),
      tradedAt: gone.tradedAt.toISOString(),
      createdAt: gone.createdAt.toISOString(),
    },
  };
}

/** Undo of a deleted trade: the same trade, in its own place in the history. */
export async function restoreTrade(formData: FormData): Promise<void> {
  const operator = await requireWriter();
  const assetId = str(formData, "assetId");
  const asset = assetId
    ? await prisma.asset.findFirst({ where: { id: assetId, operatorId: operator.id }, select: { id: true } })
    : null;
  if (!asset) return;
  const quantity = Number(str(formData, "quantity"));
  const unitPrice = Number(str(formData, "unitPrice"));
  const tradedAt = new Date(str(formData, "tradedAt"));
  const createdAt = new Date(str(formData, "createdAt"));
  if (!(quantity > 0) || !(unitPrice >= 0) || Number.isNaN(tradedAt.getTime()) || Number.isNaN(createdAt.getTime())) return;
  await prisma.cryptoTrade.create({
    data: {
      assetId,
      side: str(formData, "side") === "sell" ? "sell" : "buy",
      quantity,
      unitPrice,
      tradedAt,
      createdAt: createdAt > new Date() ? new Date() : createdAt,
    },
  });
  revalidatePath("/assets");
  revalidatePath("/");
  revalidatePath(`/assets/${assetId}/edit`);
}
