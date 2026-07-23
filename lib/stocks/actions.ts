"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { POPULAR_STOCKS } from "@/lib/stocks/prices";
import type { FormState } from "@/lib/units/actions";

// Buy/sell entry and deletion are shared with crypto — the trade table is
// the same shape, so the buy/sell UI imports addTrade/deleteTrade straight
// from "@/lib/crypto/actions". A "use server" module can only export async
// server functions, so we don't re-export them here.

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// Create a stock holding (an Asset with category "stock"). The user picks
// a popular ticker or types any US ticker manually.
export async function createStock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireOperator();
  const ticker = str(formData, "symbol").toUpperCase();
  if (!ticker) return { error: "error_required" };

  const name = POPULAR_STOCKS[ticker] || str(formData, "name") || ticker;

  const { getBillingContext } = await import("@/lib/billing/context");
  if (!(await getBillingContext(operator)).canAddAsset) {
    return { error: "error_limit_assets" };
  }

  const asset = await prisma.asset.create({
    data: {
      operatorId: operator.id,
      name,
      category: "stock",
      type: "share",
      symbol: ticker,
      currency: "USD",
      status: "personal_use",
    },
  });
  revalidatePath("/assets");
  redirect(`/assets/${asset.id}/edit`);
}
