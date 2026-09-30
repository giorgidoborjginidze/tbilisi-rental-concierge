// One-off backfill: link units and real-estate assets that are obviously
// the same flat — same workspace, IDENTICAL name, neither side linked yet,
// and that name unique on both sides (lib/property/link.ts namePairs).
// Nothing else: no unit or asset is created, renamed or deleted, and a
// pair whose names differ in any way stays as it is (the owner can link it
// from the unit or asset form, or with "Add to Rentals" on /units).
//
// Idempotent (only unlinked rows are considered) and one-off per database:
// the run is recorded as a SystemRun of kind "link-properties" and later
// runs do nothing, so a pair the owner deliberately unlinks afterwards is
// never linked again. `--force` runs it anyway.
//
//   npm run db:link-properties            (local SQLite or DATABASE_URL)
//   npx tsx scripts/link-properties.ts --dry-run
//
// scripts/prepare-db.mjs runs it on deploys (non-fatal).

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { namePairs } from "../lib/property/link";

const KIND = "link-properties";

// Same adapter selection as lib/db.ts.
const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = url.startsWith("postgres")
  ? new PrismaPg({ connectionString: url })
  : new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

async function main() {
  if (!force && !dryRun) {
    const done = await prisma.systemRun.findFirst({ where: { kind: KIND, ok: true } });
    if (done) {
      console.log(`[link-properties] already ran on ${done.startedAt.toISOString()} — nothing to do`);
      return;
    }
  }

  const [units, assets] = await Promise.all([
    prisma.unit.findMany({
      where: { asset: null },
      select: { id: true, operatorId: true, name: true },
    }),
    prisma.asset.findMany({
      where: { category: "real_estate", unitId: null },
      select: { id: true, operatorId: true, name: true },
    }),
  ]);
  const pairs = namePairs(units, assets);

  if (dryRun) {
    const names = new Map(units.map((unit) => [unit.id, unit.name]));
    for (const pair of pairs) console.log(`[link-properties] would link "${names.get(pair.unitId)}"`);
    console.log(`[link-properties] dry run: ${pairs.length} pair(s)`);
    return;
  }

  const startedAt = new Date();
  let linked = 0;
  for (const pair of pairs) {
    // Guarded: only while the asset is still unlinked (a unit can hold one
    // asset — the unique index refuses a second).
    try {
      const { count } = await prisma.asset.updateMany({
        where: { id: pair.assetId, unitId: null },
        data: { unitId: pair.unitId },
      });
      linked += count;
    } catch (error) {
      console.warn(
        `[link-properties] skipped a pair: ${error instanceof Error ? error.message.split("\n")[0] : error}`,
      );
    }
  }
  await prisma.systemRun.create({
    data: {
      kind: KIND,
      startedAt,
      finishedAt: new Date(),
      ok: true,
      summary: { candidates: pairs.length, linked },
    },
  });
  console.log(`[link-properties] linked ${linked} unit/asset pair(s) with identical names`);
}

main()
  .catch((error) => {
    console.error("[link-properties] failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
