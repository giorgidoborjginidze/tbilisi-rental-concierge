-- CreateTable
CREATE TABLE "MarketFigure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "district" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "period" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL DEFAULT '',
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MarketFigure_district_metric_idx" ON "MarketFigure"("district", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "MarketFigure_district_metric_period_source_sourceName_key" ON "MarketFigure"("district", "metric", "period", "source", "sourceName");
