-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "addressApprox" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "areaSqm" REAL,
    "rooms" INTEGER,
    "bedrooms" INTEGER,
    "floor" INTEGER,
    "furnished" BOOLEAN NOT NULL DEFAULT false,
    "heating" TEXT,
    "petsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "availableFrom" DATETIME,
    "postedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rawText" TEXT,
    "rawTextKa" TEXT,
    "photos" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "SearchRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userEmail" TEXT NOT NULL,
    "rawQuery" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "structuredCriteria" TEXT NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "searchRequestId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "reasons" TEXT NOT NULL DEFAULT '[]',
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_searchRequestId_fkey" FOREIGN KEY ("searchRequestId") REFERENCES "SearchRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Listing_type_idx" ON "Listing"("type");

-- CreateIndex
CREATE INDEX "Listing_district_idx" ON "Listing"("district");

-- CreateIndex
CREATE INDEX "Listing_price_idx" ON "Listing"("price");

-- CreateIndex
CREATE INDEX "Listing_isActive_idx" ON "Listing"("isActive");

-- CreateIndex
CREATE INDEX "Listing_lastSeenAt_idx" ON "Listing"("lastSeenAt");

-- CreateIndex
CREATE INDEX "SearchRequest_userEmail_idx" ON "SearchRequest"("userEmail");

-- CreateIndex
CREATE INDEX "SearchRequest_isActive_idx" ON "SearchRequest"("isActive");

-- CreateIndex
CREATE INDEX "Match_searchRequestId_idx" ON "Match"("searchRequestId");

-- CreateIndex
CREATE INDEX "Match_score_idx" ON "Match"("score");

-- CreateIndex
CREATE INDEX "Match_notified_idx" ON "Match"("notified");

-- CreateIndex
CREATE UNIQUE INDEX "Match_searchRequestId_listingId_key" ON "Match"("searchRequestId", "listingId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
