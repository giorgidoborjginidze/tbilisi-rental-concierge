// The one "what am I worth" figure — the dashboard hero, the composition
// ring and the /assets total all read it, so they can never disagree.
// Holdings are valued in GEL at the NBG rate (lib/prices/quotes.ts).

import { cache } from "react";
import { prisma } from "@/lib/db";
import { loadQuotes, type QuoteRequest } from "@/lib/prices/quotes";
import { loadGelRates } from "@/lib/fx/gel-rates";
import { anyForeign, toGel } from "@/lib/fx/convert";
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
      currency: true,
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

  // A flat valued in dollars counts in lari at today's NBG rate (lib/fx).
  const rates = await loadGelRates();
  const converted = anyForeign(
    assets.filter((asset) => !isHolding(asset.category) && asset.estimatedValue).map((asset) => asset.currency),
  );
  const worth = composeNetWorth(
    assets.map(({ currency, ...asset }) => ({
      ...asset,
      estimatedValue: asset.estimatedValue == null ? null : toGel(asset.estimatedValue, currency, rates),
      trades: asset.trades.map((trade) => ({ ...trade, side: trade.side === "sell" ? "sell" : "buy" })),
    })),
    quotes,
    rate,
  );
  // A value given in dollars or euros makes the total approximate too.
  return converted ? { ...worth, approximate: true, converted: true } : worth;
});
