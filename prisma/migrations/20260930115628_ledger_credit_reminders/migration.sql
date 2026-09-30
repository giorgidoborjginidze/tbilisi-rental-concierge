-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "statusSetAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RentalContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "tenantName" TEXT,
    "tenantPhone" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "monthlyRent" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "deposit" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentPeriod" TEXT NOT NULL DEFAULT 'monthly',
    "paymentAmount" REAL,
    "graceDays" INTEGER NOT NULL DEFAULT 3,
    "paidThrough" DATETIME,
    "creditBalance" REAL NOT NULL DEFAULT 0,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "openingPaidThrough" DATETIME,
    "openingCredit" REAL NOT NULL DEFAULT 0,
    "openingAt" DATETIME,
    CONSTRAINT "RentalContract_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RentalContract" ("assetId", "createdAt", "currency", "deposit", "endDate", "graceDays", "id", "monthlyRent", "notes", "paidThrough", "paymentAmount", "paymentPeriod", "startDate", "status", "tenantName", "tenantPhone") SELECT "assetId", "createdAt", "currency", "deposit", "endDate", "graceDays", "id", "monthlyRent", "notes", "paidThrough", "paymentAmount", "paymentPeriod", "startDate", "status", "tenantName", "tenantPhone" FROM "RentalContract";
DROP TABLE "RentalContract";
ALTER TABLE "new_RentalContract" RENAME TO "RentalContract";
CREATE INDEX "RentalContract_assetId_endDate_idx" ON "RentalContract"("assetId", "endDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
