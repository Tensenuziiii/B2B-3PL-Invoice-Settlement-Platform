-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "approvedAt" TIMESTAMPTZ(6),
ADD COLUMN     "cancelledAt" TIMESTAMPTZ(6),
ADD COLUMN     "rejectedAt" TIMESTAMPTZ(6),
ADD COLUMN     "submittedAt" TIMESTAMPTZ(6);
