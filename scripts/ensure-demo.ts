// Idempotent: marks the shared public demo account (its sign-in is printed
// on the landing and login pages) as the read-only demo. Runs on every
// deploy after the schema sync (scripts/prepare-db.mjs) and is fatal there:
// the demo must never be writable, whatever happened to the seed step.
// A second run changes nothing.

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEMO_EMAIL } from "../lib/auth/demo";

// Same adapter selection as lib/db.ts.
const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = url.startsWith("postgres")
  ? new PrismaPg({ connectionString: url })
  : new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const { count } = await prisma.operator.updateMany({
    where: { email: DEMO_EMAIL, isDemo: false },
    data: { isDemo: true },
  });
  console.log(`[ensure-demo] ${count ? "demo account flagged read-only" : "demo flag already set (or no demo account)"}`);
}

main()
  .catch((error) => {
    console.error("[ensure-demo] failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
