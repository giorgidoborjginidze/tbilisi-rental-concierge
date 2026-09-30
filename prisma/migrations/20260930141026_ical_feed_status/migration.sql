-- CreateTable
CREATE TABLE "UnitFeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "lastAttemptAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "lastError" TEXT,
    "lastStatus" INTEGER,
    "lastCount" INTEGER,
    "lastCancelled" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnitFeed_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "guestName" TEXT,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "nights" INTEGER NOT NULL,
    "amount" REAL,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "externalId" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedId" TEXT,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    CONSTRAINT "Booking_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "UnitFeed" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("amount", "checkIn", "checkOut", "currency", "externalId", "guestName", "id", "importedAt", "nights", "source", "status", "unitId") SELECT "amount", "checkIn", "checkOut", "currency", "externalId", "guestName", "id", "importedAt", "nights", "source", "status", "unitId" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_unitId_checkIn_idx" ON "Booking"("unitId", "checkIn");
CREATE INDEX "Booking_feedId_idx" ON "Booking"("feedId");
CREATE UNIQUE INDEX "Booking_unitId_source_externalId_key" ON "Booking"("unitId", "source", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UnitFeed_unitId_url_key" ON "UnitFeed"("unitId", "url");
