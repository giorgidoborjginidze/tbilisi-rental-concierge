-- AlterTable
ALTER TABLE "NotifyMessage" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "NotifyMessage" ADD COLUMN "cancelledAt" DATETIME;
