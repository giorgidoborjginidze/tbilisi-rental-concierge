-- AlterTable
ALTER TABLE "Operator" ADD COLUMN "payInstructions" TEXT;

-- AlterTable
ALTER TABLE "RentalContract" ADD COLUMN "messagesOptOutAt" DATETIME;
ALTER TABLE "RentalContract" ADD COLUMN "waConsentAt" DATETIME;
