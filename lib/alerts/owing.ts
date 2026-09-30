// A finished contract that still owes rent is rent, not advice. The scan
// raises "contract ended" for it (with the unpaid amount) when no rent
// alert covers it any more; a clean ending — nothing owed — is only a tip
// to renew or relist. These helpers tell the two apart, so the bell counts
// an unpaid ending, /alerts opens its group, and Market Advice leaves it to
// the dashboard's rent card for that asset instead of showing it twice.

import { prisma } from "@/lib/db";
import { hasBalance, type DailyPricing } from "@/lib/rentals/terms";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { startOfTodayTbilisi } from "@/lib/time";

type EndedContract = Parameters<typeof hasBalance>[0] & { id: string };

interface EndingAlert {
  id: string;
  type: string;
  payload: unknown;
}

const contractIdOf = (payload: unknown): string | null => {
  const id = (payload as { contractId?: unknown } | null)?.contractId;
  return typeof id === "string" && id ? id : null;
};

/**
 * The ids of "contract ended" alerts whose contract still owes rent on
 * `today`. Pure: `contracts` are the (live) contracts the alerts name, with
 * their asset's daily pricing.
 */
export function owingEndings(
  alerts: readonly EndingAlert[],
  contracts: ReadonlyMap<string, EndedContract & { pricing: DailyPricing | null }>,
  today: Date,
): Set<string> {
  const owing = new Set<string>();
  for (const alert of alerts) {
    if (alert.type !== "contract_ended") continue;
    const id = contractIdOf(alert.payload);
    const contract = id ? contracts.get(id) : undefined;
    if (contract && hasBalance(contract, today, contract.pricing)) owing.add(alert.id);
  }
  return owing;
}

/** Loads the contracts behind the "contract ended" alerts and returns those still owing. */
export async function owingEndingIds(
  operatorId: string,
  alerts: readonly EndingAlert[],
  today: Date = startOfTodayTbilisi(),
): Promise<Set<string>> {
  const ids = [
    ...new Set(
      alerts
        .filter((alert) => alert.type === "contract_ended")
        .map((alert) => contractIdOf(alert.payload))
        .filter((id): id is string => id != null),
    ),
  ];
  if (ids.length === 0) return new Set();
  const rows = await prisma.rentalContract.findMany({
    where: { id: { in: ids }, asset: { operatorId }, ...LIVE_CONTRACT },
    include: { asset: { select: { dailyRate: true, weekendPct: true, holidayPct: true } } },
  });
  return owingEndings(
    alerts,
    new Map(rows.map((row) => [row.id, { ...row, pricing: row.asset }])),
    today,
  );
}
