-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('FIXED_TRIP', 'PER_DELIVERY', 'PER_KM');

-- CreateEnum
CREATE TYPE "CounterpartyType" AS ENUM ('CLIENT', 'VENDOR');

-- CreateTable
CREATE TABLE "RateCard" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "counterpartyType" "CounterpartyType" NOT NULL,
    "clientId" UUID,
    "vendorId" UUID,
    "validFrom" TIMESTAMPTZ(6) NOT NULL,
    "validTo" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCardItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "rateCardId" UUID NOT NULL,
    "rateType" "RateType" NOT NULL,
    "routeId" UUID,
    "tripType" TEXT,
    "serviceType" TEXT,
    "rate" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateCardItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateCard_organizationId_idx" ON "RateCard"("organizationId");

-- CreateIndex
CREATE INDEX "RateCard_organizationId_counterpartyType_clientId_idx" ON "RateCard"("organizationId", "counterpartyType", "clientId");

-- CreateIndex
CREATE INDEX "RateCard_organizationId_counterpartyType_vendorId_idx" ON "RateCard"("organizationId", "counterpartyType", "vendorId");

-- CreateIndex
CREATE INDEX "RateCard_organizationId_status_idx" ON "RateCard"("organizationId", "status");

-- CreateIndex
CREATE INDEX "RateCard_organizationId_validFrom_validTo_idx" ON "RateCard"("organizationId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "RateCardItem_organizationId_idx" ON "RateCardItem"("organizationId");

-- CreateIndex
CREATE INDEX "RateCardItem_rateCardId_idx" ON "RateCardItem"("rateCardId");

-- CreateIndex
CREATE INDEX "RateCardItem_organizationId_rateType_idx" ON "RateCardItem"("organizationId", "rateType");

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCardItem" ADD CONSTRAINT "RateCardItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCardItem" ADD CONSTRAINT "RateCardItem_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "RateCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCardItem" ADD CONSTRAINT "RateCardItem_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;
