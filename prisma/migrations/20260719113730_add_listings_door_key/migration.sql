-- AlterTable
ALTER TABLE "Lease" ADD COLUMN "tenantPhone" TEXT;

-- AlterTable
ALTER TABLE "RentalContract" ADD COLUMN "tenantPhone" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKa" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "city" TEXT,
    "district" TEXT,
    "address" TEXT,
    "areaSqm" REAL,
    "estimatedValue" REAL,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "status" TEXT NOT NULL DEFAULT 'personal_use',
    "rentalMode" TEXT NOT NULL DEFAULT 'long_term',
    "unitId" TEXT,
    "myhomeUrl" TEXT,
    "ssUrl" TEXT,
    "myautoUrl" TEXT,
    "airbnbUrl" TEXT,
    "bookingUrl" TEXT,
    "doorCode" TEXT,
    "doorCodeGeneratedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("address", "areaSqm", "category", "city", "createdAt", "currency", "district", "estimatedValue", "id", "myhomeUrl", "name", "nameKa", "notes", "operatorId", "status", "type", "unitId") SELECT "address", "areaSqm", "category", "city", "createdAt", "currency", "district", "estimatedValue", "id", "myhomeUrl", "name", "nameKa", "notes", "operatorId", "status", "type", "unitId" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE UNIQUE INDEX "Asset_unitId_key" ON "Asset"("unitId");
CREATE INDEX "Asset_operatorId_idx" ON "Asset"("operatorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
