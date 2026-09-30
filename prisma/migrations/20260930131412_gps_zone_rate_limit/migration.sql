-- AlterTable
ALTER TABLE "Geofence" ADD COLUMN "lastZone" TEXT;

-- AlterTable
ALTER TABLE "GpsDevice" ADD COLUMN "lastReceivedAt" DATETIME;
