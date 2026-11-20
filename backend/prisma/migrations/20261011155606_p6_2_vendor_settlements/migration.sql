-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID');

-- CreateTable
CREATE TABLE "VendorSettlement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "vendorId" UUID NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMPTZ(6),
    "periodEnd" TIMESTAMPTZ(6),
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "adjustments" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMPTZ(6),
    "approvedAt" TIMESTAMPTZ(6),
    "paidAt" TIMESTAMPTZ(6),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "VendorSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorSettlementItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "settlementId" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "lineAmount" INTEGER NOT NULL,
    "snapshot" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorSettlementItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorSettlement_organizationId_idx" ON "VendorSettlement"("organizationId");

-- CreateIndex
CREATE INDEX "VendorSettlement_organizationId_status_idx" ON "VendorSettlement"("organizationId", "status");

-- CreateIndex
CREATE INDEX "VendorSettlement_organizationId_vendorId_idx" ON "VendorSettlement"("organizationId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorSettlement_organizationId_settlementNumber_key" ON "VendorSettlement"("organizationId", "settlementNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VendorSettlementItem_tripId_key" ON "VendorSettlementItem"("tripId");

-- CreateIndex
CREATE INDEX "VendorSettlementItem_organizationId_idx" ON "VendorSettlementItem"("organizationId");

-- CreateIndex
CREATE INDEX "VendorSettlementItem_settlementId_idx" ON "VendorSettlementItem"("settlementId");

-- AddForeignKey
ALTER TABLE "VendorSettlement" ADD CONSTRAINT "VendorSettlement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSettlement" ADD CONSTRAINT "VendorSettlement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSettlementItem" ADD CONSTRAINT "VendorSettlementItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSettlementItem" ADD CONSTRAINT "VendorSettlementItem_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "VendorSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSettlementItem" ADD CONSTRAINT "VendorSettlementItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
