-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "licenseExpiry" TIMESTAMPTZ(6),
ADD COLUMN     "licenseNo" TEXT;

-- CreateIndex
CREATE INDEX "Driver_organizationId_active_idx" ON "Driver"("organizationId", "active");

-- CreateIndex
CREATE INDEX "Driver_organizationId_phone_idx" ON "Driver"("organizationId", "phone");
