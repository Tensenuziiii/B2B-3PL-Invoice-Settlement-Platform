-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('DISPUTED', 'UNDER_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('ACCEPTED', 'REJECTED', 'PARTIAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE "Dispute" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "disputeNumber" TEXT NOT NULL,
    "invoiceLineId" UUID NOT NULL,
    "raisedById" UUID NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "evidenceDocId" UUID,
    "amountPaise" INTEGER NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'DISPUTED',
    "resolution" "DisputeResolution",
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMPTZ(6),
    "resolutionNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "disputeId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dispute_organizationId_idx" ON "Dispute"("organizationId");

-- CreateIndex
CREATE INDEX "Dispute_organizationId_status_idx" ON "Dispute"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_organizationId_disputeNumber_key" ON "Dispute"("organizationId", "disputeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_invoiceLineId_key" ON "Dispute"("invoiceLineId");

-- CreateIndex
CREATE INDEX "Message_organizationId_idx" ON "Message"("organizationId");

-- CreateIndex
CREATE INDEX "Message_disputeId_createdAt_idx" ON "Message"("disputeId", "createdAt");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_evidenceDocId_fkey" FOREIGN KEY ("evidenceDocId") REFERENCES "PodDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
