-- CreateTable
CREATE TABLE "Asset" (
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
    "unitId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "tenantName" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "monthlyRent" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "deposit" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalContract_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncomeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomeRecord_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IncomeRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentBenchmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "district" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "avgRentPerSqm" REAL NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'mock'
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_unitId_key" ON "Asset"("unitId");

-- CreateIndex
CREATE INDEX "Asset_operatorId_idx" ON "Asset"("operatorId");

-- CreateIndex
CREATE INDEX "RentalContract_assetId_endDate_idx" ON "RentalContract"("assetId", "endDate");

-- CreateIndex
CREATE INDEX "IncomeRecord_operatorId_date_idx" ON "IncomeRecord"("operatorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RentBenchmark_district_month_key" ON "RentBenchmark"("district", "month");
