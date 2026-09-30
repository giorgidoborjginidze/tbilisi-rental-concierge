// Idempotent data repair for the rent ledger fix. Runs locally
// (`npm run db:repair`) and on every deploy right after the schema sync
// (scripts/prepare-db.mjs). A second run changes nothing.
//
// For every contract whose ledger was never opened (openingAt is null):
//   - the amount typed in becomes paymentAmount (per period) and
//     monthlyRent becomes its monthly equivalent;
//   - a contract that was saved as "unpaid since the start" and has no
//     recorded payment goes back to untracked, so the owner states "paid
//     up to" once instead of seeing a false debt;
//   - the ledger opens at the contract's current position.
// The false "rent late" / "repossession right" alerts of the contracts set
// back to untracked are resolved, and the WhatsApp messages they queued
// and never sent are removed. The rules live in lib/rentals/repair.ts.

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { planContractRepair } from "../lib/rentals/repair";
import { PAYMENT_TEMPLATES } from "../lib/notify/templates";
import { startOfTodayTbilisi } from "../lib/time";
import { settlePaidRent } from "../lib/rentals/settle";

// Same adapter selection as lib/db.ts.
const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = url.startsWith("postgres")
  ? new PrismaPg({ connectionString: url })
  : new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date();
  const repairDay = startOfTodayTbilisi(now);

  const legacy = await prisma.rentalContract.findMany({
    where: { openingAt: null },
    include: {
      asset: { select: { rentalMode: true } },
      _count: { select: { payments: true } },
    },
  });

  let updated = 0;
  const cleared: string[] = [];
  for (const contract of legacy) {
    const plan = planContractRepair(
      { ...contract, paymentCount: contract._count.payments },
      repairDay,
      now,
    );
    if (!plan) continue;
    const { untracked, ...data } = plan;
    await prisma.rentalContract.update({ where: { id: contract.id }, data });
    updated += 1;
    if (untracked) cleared.push(contract.id);
  }

  let resolved = 0;
  let removed = 0;
  if (cleared.length > 0) {
    const clearedSet = new Set(cleared);
    const alerts = await prisma.alert.findMany({
      where: { type: { in: ["rent_overdue", "repossession_right"] }, status: "open" },
      select: { id: true, payload: true },
    });
    const alertIds = alerts
      .filter((alert) =>
        clearedSet.has((alert.payload as { contractId?: string }).contractId ?? ""),
      )
      .map((alert) => alert.id);
    if (alertIds.length > 0) {
      resolved = (
        await prisma.alert.updateMany({
          where: { id: { in: alertIds } },
          data: { status: "resolved", resolvedAt: now },
        })
      ).count;
    }

    const kinds = Object.values(PAYMENT_TEMPLATES).flatMap((keys) => Object.values(keys));
    removed = (
      await prisma.notifyMessage.deleteMany({
        where: {
          contractId: { in: cleared },
          status: { in: ["queued", "failed"] },
          kind: { in: kinds },
        },
      })
    ).count;
  }

  // Alerts and unsent reminders about due dates that have since been paid
  // (the old code left them open after a payment was recorded).
  const tracked = await prisma.rentalContract.findMany({
    where: { paidThrough: { not: null } },
    select: { id: true, paidThrough: true },
  });
  for (const contract of tracked) {
    const settled = await settlePaidRent(prisma, contract.id, contract.paidThrough, now);
    resolved += settled.resolved;
    removed += settled.cancelled;
  }

  console.log(
    `[repair-ledger] ${updated} contract(s) brought onto the ledger, ` +
      `${cleared.length} false debt(s) cleared, ${resolved} alert(s) resolved, ` +
      `${removed} unsent message(s) removed or withdrawn.`,
  );
}

main()
  .catch((error) => {
    console.error("[repair-ledger] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
