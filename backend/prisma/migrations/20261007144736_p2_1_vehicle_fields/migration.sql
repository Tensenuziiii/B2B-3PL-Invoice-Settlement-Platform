-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "capacityKg" INTEGER,
ADD COLUMN     "type" TEXT;

-- CreateIndex
CREATE INDEX "Vehicle_organizationId_active_idx" ON "Vehicle"("organizationId", "active");
