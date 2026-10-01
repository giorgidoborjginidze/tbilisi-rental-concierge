-- CreateTable
CREATE TABLE "CalendarExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarExport_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarExport_unitId_key" ON "CalendarExport"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarExport_token_key" ON "CalendarExport"("token");
