-- CreateTable
CREATE TABLE "PriceQuote" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "price" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "fetchedAt" DATETIME NOT NULL
);
