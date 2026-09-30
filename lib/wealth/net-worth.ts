// The one "what am I worth" figure — the dashboard hero, the composition
// ring and the /assets total all read it, so they can never disagree.
// Holdings are valued in GEL at the NBG rate (lib/prices/quotes.ts).

import { cache } from "react";
import { prisma } from "@/lib/db";
import { loadQuotes, type QuoteRequest } from "@/lib/prices/quotes";
import { composeNetWorth, holdingQuoteKey, isHolding, type NetWorth } from "./compose";

export type { NetWorth, HoldingLine, ValueBasis } from "./compose";

export const getNetWorth = cache(async (operatorId: string): Promise<NetWorth> => {
  const assets = await prisma.asset.findMany({
    where: { operatorId },
    select: {
      id: true,
      name: true,
      nameKa: true,
      category: true,
      symbol: true,
      coingeckoId: true,
      estimatedValue: true,
      trades: {
        select: { side: true, quantity: true, unitPrice: true, tradedAt: true, createdAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const requests: QuoteRequest[] = [];
  for (const asset of assets) {
    if (!isHolding(asset.category) || !holdingQuoteKey(asset)) continue;
    requests.push({
      kind: asset.category,
      id: asset.category === "crypto" ? asset.coingeckoId! : asset.symbol!,
    });
  }
  // No holdings: no network, no rate needed (the rate is only used for them).
  const { quotes, rate } = requests.length
    ? await loadQuotes(requests)
    : { quotes: new Map(), rate: { value: 0, fetchedAt: null, state: "live" as const } };

  return composeNetWorth(
    assets.map((asset) => ({
      ...asset,
      trades: asset.trades.map((trade) => ({ ...trade, side: trade.side === "sell" ? "sell" : "buy" })),
    })),
    quotes,
    rate,
  );
});
