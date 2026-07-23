-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "coingeckoId" TEXT;
ALTER TABLE "Asset" ADD COLUMN "symbol" TEXT;

-- CreateTable
CREATE TABLE "CryptoTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "tradedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CryptoTrade_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CryptoTrade_assetId_tradedAt_idx" ON "CryptoTrade"("assetId", "tradedAt");
