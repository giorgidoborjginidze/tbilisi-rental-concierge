-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "monthlyIncome" REAL;

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
    "plan" TEXT,
    "trialEndsAt" DATETIME,
    "planSetAt" DATETIME,
    "companyId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'owner',
    CONSTRAINT "Operator_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Operator" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Operator" ("accountType", "companyId", "createdAt", "email", "id", "locale", "name", "passwordHash", "plan", "planSetAt", "role", "trialEndsAt") SELECT "accountType", "companyId", "createdAt", "email", "id", "locale", "name", "passwordHash", "plan", "planSetAt", "role", "trialEndsAt" FROM "Operator";
DROP TABLE "Operator";
ALTER TABLE "new_Operator" RENAME TO "Operator";
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");
CREATE INDEX "Operator_companyId_idx" ON "Operator"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
