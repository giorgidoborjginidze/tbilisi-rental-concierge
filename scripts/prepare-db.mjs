// Pre-build database step. Runs before `next build`:
//
//   SQLite (local, default)  → generate the Prisma client from schema.prisma
//   Postgres (DATABASE_URL=postgres…, e.g. Vercel + Neon)
//     → derive prisma/schema.postgres.prisma from schema.prisma
//       (provider swap only — single source of truth),
//       generate the client from it, and on Vercel push the schema
//       to the database (prisma db push), then run the idempotent data
//       repairs (scripts/repair-ledger.ts).
//
// The push NEVER passes --accept-data-loss: a change that would drop or
// rewrite data (a removed or renamed column, a new unique constraint over
// existing rows) makes `db push` refuse, and the deploy fails before
// anything is lost. Schema changes must be additive (new tables, new
// columns with defaults); anything else needs a planned migration.
//
// Keeps one schema file authoritative while supporting both databases.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const url = process.env.DATABASE_URL ?? "";
const isPostgres = url.startsWith("postgres");

const run = (cmd) => {
  console.log(`[prepare-db] ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

if (!isPostgres) {
  run("npx prisma generate");
} else {
  const schema = readFileSync("prisma/schema.prisma", "utf8").replace(
    'provider = "sqlite"',
    'provider = "postgresql"',
  );
  writeFileSync(
    "prisma/schema.postgres.prisma",
    "// GENERATED from schema.prisma by scripts/prepare-db.mjs — do not edit.\n" +
      schema,
  );
  run("npx prisma generate --schema prisma/schema.postgres.prisma");
  if (process.env.VERCEL) {
    // Managed deploy: sync the schema (no migration history needed yet).
    // (Prisma 7 dropped --skip-generate; the extra generate is harmless.)
    // Without --accept-data-loss: a destructive change fails the deploy
    // here instead of silently dropping customer data.
    try {
      run("npx prisma db push --schema prisma/schema.postgres.prisma");
    } catch (error) {
      console.error(
        "[prepare-db] schema push refused. If Prisma reported possible data loss, the schema change " +
          "is not additive (a removed/renamed column or a new unique constraint). Nothing was changed; " +
          "make the change additive or migrate the data deliberately — never add --accept-data-loss here.",
      );
      throw error;
    }
    // Ensure the demo account exists (idempotent, additive — the seed
    // skips itself if the demo is already there and never wipes data).
    try {
      run("npx tsx prisma/seed.ts");
    } catch {
      console.warn("[prepare-db] demo seed skipped (non-fatal)");
    }
    // The shared public demo must be read-only whatever happened to the
    // seed above. Idempotent; fatal on failure.
    run("npx tsx scripts/ensure-demo.ts");
    // Bring rows written before the rent-ledger fix onto it: per-period
    // amounts, no false "unpaid since the start" debts. Idempotent. Fatal
    // on failure — deploying the new ledger over unrepaired rows would
    // show owners wrong monthly figures.
    run("npx tsx scripts/repair-ledger.ts");
    // Accounts whose language was never chosen speak Georgian (their
    // tenant and driver messages follow it). Idempotent; never touches a
    // language an owner picked.
    run("npx tsx scripts/backfill-locale.ts");
    // Units and real-estate assets that are the same flat under the same
    // name become one place (one-off per database, recorded in SystemRun;
    // links identical names only). Non-fatal: nothing breaks without it.
    try {
      run("npx tsx scripts/link-properties.ts");
    } catch {
      console.warn("[prepare-db] unit/asset linking skipped (non-fatal)");
    }
  }
}
