// Idempotent: accounts whose language was never chosen (Operator.localeSetAt
// is null) speak Georgian — the product's language. Before the language was
// stored, nothing ever wrote Operator.locale, so its old "en" default was
// not a choice, and every WhatsApp message to Georgian tenants and drivers
// went out in English. Registration, sign-in and the language switch set
// localeSetAt, so a language an owner picked is never overwritten. Runs on
// every deploy after the schema sync (scripts/prepare-db.mjs).

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

// Same adapter selection as lib/db.ts.
const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = url.startsWith("postgres")
  ? new PrismaPg({ connectionString: url })
  : new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const { count } = await prisma.operator.updateMany({
    where: { localeSetAt: null, locale: { not: "ka" } },
    data: { locale: "ka" },
  });
  console.log(`[backfill-locale] ${count} account(s) moved to Georgian (language never chosen)`);
}

main()
  .catch((error) => {
    console.error("[backfill-locale] failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
