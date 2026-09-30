-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Operator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
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
INSERT INTO "new_Operator" ("accountType", "companyId", "createdAt", "email", "id", "locale", "name", "notifyPhone", "paidUntil", "passwordHash", "plan", "planSetAt", "profile", "role", "trialEndsAt") SELECT "accountType", "companyId", "createdAt", "email", "id", "locale", "name", "notifyPhone", "paidUntil", "passwordHash", "plan", "planSetAt", "profile", "role", "trialEndsAt" FROM "Operator";
DROP TABLE "Operator";
ALTER TABLE "new_Operator" RENAME TO "Operator";
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");
CREATE INDEX "Operator_companyId_idx" ON "Operator"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PasswordReset_operatorId_idx" ON "PasswordReset"("operatorId");

-- CreateIndex
CREATE INDEX "AuthAttempt_kind_email_createdAt_idx" ON "AuthAttempt"("kind", "email", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_kind_ip_createdAt_idx" ON "AuthAttempt"("kind", "ip", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_createdAt_idx" ON "AuthAttempt"("createdAt");
