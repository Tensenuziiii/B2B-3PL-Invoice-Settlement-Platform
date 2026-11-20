/*
  Warnings:

  - The `status` column on the `TripStop` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Pod` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `collectionType` on table `TripStop` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TripStopStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "PodDocumentType" AS ENUM ('PHOTO', 'SIGNATURE', 'LR', 'OTHER');

-- DropForeignKey
ALTER TABLE "Pod" DROP CONSTRAINT "Pod_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Pod" DROP CONSTRAINT "Pod_tripId_fkey";

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "assignedAt" TIMESTAMPTZ(6),
ADD COLUMN     "auditRequestedAt" TIMESTAMPTZ(6),
ADD COLUMN     "auditedAt" TIMESTAMPTZ(6),
ADD COLUMN     "closedAt" TIMESTAMPTZ(6),
ADD COLUMN     "deliveredAt" TIMESTAMPTZ(6),
ADD COLUMN     "readyForBillingAt" TIMESTAMPTZ(6),
ADD COLUMN     "routeId" UUID,
ADD COLUMN     "startedAt" TIMESTAMPTZ(6),
ADD COLUMN     "vendorId" UUID;

-- AlterTable
ALTER TABLE "TripStop" ALTER COLUMN "collectionType" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "TripStopStatus" NOT NULL DEFAULT 'PENDING';

-- DropTable
DROP TABLE "Pod";

-- CreateTable
CREATE TABLE "PodDocument" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "tripStopId" UUID NOT NULL,
    "documentType" "PodDocumentType" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "signatoryName" TEXT,
    "dockGpsLat" DOUBLE PRECISION,
    "dockGpsLng" DOUBLE PRECISION,
    "gateInTimestamp" TIMESTAMPTZ(6),
    "stampVerified" BOOLEAN NOT NULL DEFAULT false,
    "authHash" TEXT,
    "uploadedById" UUID,
    "ocrResult" JSONB,
    "validationResult" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "tripStopId" UUID NOT NULL,
    "actualAmount" INTEGER NOT NULL,
    "mode" "CollectionMode" NOT NULL,
    "referenceId" TEXT,
    "collectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PodDocument_organizationId_idx" ON "PodDocument"("organizationId");

-- CreateIndex
CREATE INDEX "PodDocument_tripStopId_idx" ON "PodDocument"("tripStopId");

-- CreateIndex
CREATE INDEX "PodDocument_organizationId_documentType_idx" ON "PodDocument"("organizationId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_tripStopId_key" ON "Collection"("tripStopId");

-- CreateIndex
CREATE INDEX "Collection_organizationId_idx" ON "Collection"("organizationId");

-- CreateIndex
CREATE INDEX "Trip_organizationId_driverId_status_idx" ON "Trip"("organizationId", "driverId", "status");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodDocument" ADD CONSTRAINT "PodDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodDocument" ADD CONSTRAINT "PodDocument_tripStopId_fkey" FOREIGN KEY ("tripStopId") REFERENCES "TripStop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_tripStopId_fkey" FOREIGN KEY ("tripStopId") REFERENCES "TripStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
