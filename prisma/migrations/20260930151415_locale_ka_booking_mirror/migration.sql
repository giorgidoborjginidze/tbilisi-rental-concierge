-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "mirrorOf" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Operator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ka',
    "localeSetAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountType" TEXT NOT NULL DEFAULT 'personal',
    "profile" TEXT NOT NULL DEFAULT 'personal',
    "plan" TEXT,
    "trialEndsAt" DATETIME,
    "planSetAt" DATETIME,
    "paidUntil" DATETIME,
    "companyId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "notifyPhone" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Operator_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Operator" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Operator" ("accountType", "companyId", "createdAt", "email", "id", "isDemo", "locale", "name", "notifyPhone", "paidUntil", "passwordHash", "plan", "planSetAt", "profile", "role", "trialEndsAt") SELECT "accountType", "companyId", "createdAt", "email", "id", "isDemo", "locale", "name", "notifyPhone", "paidUntil", "passwordHash", "plan", "planSetAt", "profile", "role", "trialEndsAt" FROM "Operator";
DROP TABLE "Operator";
ALTER TABLE "new_Operator" RENAME TO "Operator";
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");
CREATE INDEX "Operator_companyId_idx" ON "Operator"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Nothing ever wrote Operator.locale before this change, so every existing
-- "en" is the old default, not a choice: Georgian (the product's language)
-- until the owner picks a language (localeSetAt). scripts/backfill-locale.ts
-- does the same on Postgres deploys.
UPDATE "Operator" SET "locale" = 'ka' WHERE "localeSetAt" IS NULL;
