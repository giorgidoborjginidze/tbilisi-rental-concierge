-- AlterTable
ALTER TABLE "RentalContract" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "RentalContract_assetId_deletedAt_idx" ON "RentalContract"("assetId", "deletedAt");
