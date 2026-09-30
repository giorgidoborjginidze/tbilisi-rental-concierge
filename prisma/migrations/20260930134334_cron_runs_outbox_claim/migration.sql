-- AlterTable
ALTER TABLE "NotifyMessage" ADD COLUMN "claimedAt" DATETIME;

-- CreateTable
CREATE TABLE "SystemRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "summary" JSONB
);

-- CreateIndex
CREATE INDEX "SystemRun_kind_startedAt_idx" ON "SystemRun"("kind", "startedAt");

-- CreateIndex
CREATE INDEX "NotifyMessage_toPhone_createdAt_idx" ON "NotifyMessage"("toPhone", "createdAt");
