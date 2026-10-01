-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "ownerNotifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "payInstructions" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Operator_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Operator" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Operator" ("accountType", "companyId", "createdAt", "email", "id", "isDemo", "locale", "localeSetAt", "name", "notifyPhone", "paidUntil", "passwordHash", "payInstructions", "plan", "planSetAt", "profile", "role", "trialEndsAt") SELECT "accountType", "companyId", "createdAt", "email", "id", "isDemo", "locale", "localeSetAt", "name", "notifyPhone", "paidUntil", "passwordHash", "payInstructions", "plan", "planSetAt", "profile", "role", "trialEndsAt" FROM "Operator";
DROP TABLE "Operator";
ALTER TABLE "new_Operator" RENAME TO "Operator";
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");
CREATE INDEX "Operator_companyId_idx" ON "Operator"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_operatorId_idx" ON "PushSubscription"("operatorId");
