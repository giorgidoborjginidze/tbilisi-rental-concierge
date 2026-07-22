// Pre-build database step. Runs before `next build`:
//
//   SQLite (local, default)  → generate the Prisma client from schema.prisma
//   Postgres (DATABASE_URL=postgres…, e.g. Vercel + Neon)
//     → derive prisma/schema.postgres.prisma from schema.prisma
//       (provider swap only — single source of truth),
//       generate the client from it, and on Vercel push the schema
//       to the database (prisma db push).
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
    run(
      "npx prisma db push --schema prisma/schema.postgres.prisma --accept-data-loss",
    );
    // Ensure the demo account exists (idempotent, additive — the seed
    // skips itself if the demo is already there and never wipes data).
    try {
      run("npx tsx prisma/seed.ts");
    } catch {
      console.warn("[prepare-db] demo seed skipped (non-fatal)");
    }
  }
}
