-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "plateNumber" TEXT;

-- AlterTable
ALTER TABLE "Operator" ADD COLUMN "notifyPhone" TEXT;

-- CreateTable
CREATE TABLE "RentPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentPayment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GpsDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "label" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'generic',
    "deviceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "lastLat" REAL,
    "lastLng" REAL,
    "lastSpeed" REAL,
    "lastPingAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GpsDevice_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Geofence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'circle',
    "centerLat" REAL,
    "centerLng" REAL,
    "radiusKm" REAL,
    "points" JSONB,
    "approachKm" REAL NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Geofence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeoEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "geofenceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "distanceKm" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeoEvent_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "Geofence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotifyTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotifyTemplate_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotifyMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT,
    "contractId" TEXT,
    "toPhone" TEXT NOT NULL,
    "toRole" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "dedupeKey" TEXT NOT NULL,
    "providerRef" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    CONSTRAINT "NotifyMessage_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    CONSTRAINT "RentalContract_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RentalContract" ("assetId", "createdAt", "currency", "deposit", "endDate", "id", "monthlyRent", "notes", "startDate", "status", "tenantName", "tenantPhone") SELECT "assetId", "createdAt", "currency", "deposit", "endDate", "id", "monthlyRent", "notes", "startDate", "status", "tenantName", "tenantPhone" FROM "RentalContract";
DROP TABLE "RentalContract";
ALTER TABLE "new_RentalContract" RENAME TO "RentalContract";
CREATE INDEX "RentalContract_assetId_endDate_idx" ON "RentalContract"("assetId", "endDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RentPayment_contractId_paidAt_idx" ON "RentPayment"("contractId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "GpsDevice_assetId_key" ON "GpsDevice"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "GpsDevice_deviceId_key" ON "GpsDevice"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "GpsDevice_token_key" ON "GpsDevice"("token");

-- CreateIndex
CREATE INDEX "Geofence_assetId_active_idx" ON "Geofence"("assetId", "active");

-- CreateIndex
CREATE INDEX "GeoEvent_assetId_createdAt_idx" ON "GeoEvent"("assetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotifyTemplate_operatorId_key_key" ON "NotifyTemplate"("operatorId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "NotifyMessage_dedupeKey_key" ON "NotifyMessage"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotifyMessage_operatorId_status_idx" ON "NotifyMessage"("operatorId", "status");
