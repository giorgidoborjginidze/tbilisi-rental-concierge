-- AlterTable
ALTER TABLE "Operator" ADD COLUMN "paidUntil" DATETIME;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'flitt',
    "plan" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "orderId" TEXT NOT NULL,
    "providerRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "Payment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_operatorId_idx" ON "Payment"("operatorId");
