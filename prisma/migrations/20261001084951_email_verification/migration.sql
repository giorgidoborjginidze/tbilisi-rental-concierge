-- AlterTable
ALTER TABLE "Operator" ADD COLUMN "emailVerifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerification_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EmailVerification_operatorId_idx" ON "EmailVerification"("operatorId");
