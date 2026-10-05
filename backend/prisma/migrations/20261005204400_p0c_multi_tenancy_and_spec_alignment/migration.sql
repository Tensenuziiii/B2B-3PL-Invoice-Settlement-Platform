-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('AUDITED', 'CORRECTION_REQUESTED');

-- CreateEnum
CREATE TYPE "CollectionMode" AS ENUM ('COD', 'CASH', 'UPI', 'CREDIT');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('FUEL', 'TOLL', 'PARKING', 'DRIVER_ALLOWANCE', 'EMERGENCY_FUEL', 'REPAIR', 'OTHER');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VENDOR_3PL';

-- AlterEnum
BEGIN;
CREATE TYPE "TripStatus_new" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'DELIVERY_IN_PROGRESS', 'DELIVERED', 'AUDIT_PENDING', 'CORRECTION_REQUESTED', 'AUDITED', 'READY_FOR_BILLING');
ALTER TABLE "Trip" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Trip" ALTER COLUMN "status" TYPE "TripStatus_new" USING ("status"::text::"TripStatus_new");
ALTER TYPE "TripStatus" RENAME TO "TripStatus_old";
ALTER TYPE "TripStatus_new" RENAME TO "TripStatus";
DROP TYPE "TripStatus_old";
ALTER TABLE "Trip" ALTER COLUMN "status" SET DEFAULT 'ASSIGNED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "InvoiceStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'CLIENT_REVIEW', 'APPROVED', 'PAYMENT_QUEUED', 'PAID', 'REJECTED', 'DISPUTED', 'CANCELLED', 'OVERDUE');
ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE "InvoiceStatus_new" USING ("status"::text::"InvoiceStatus_new");
ALTER TYPE "InvoiceStatus" RENAME TO "InvoiceStatus_old";
ALTER TYPE "InvoiceStatus_new" RENAME TO "InvoiceStatus";
DROP TYPE "InvoiceStatus_old";
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('TRIP', 'AUDIT', 'INVOICE', 'DISPUTE', 'PAYMENT', 'SETTLEMENT', 'INVITATION');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_clientId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_hubId_fkey";

-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_driverId_fkey";

-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_shiftId_fkey";

-- DropForeignKey
ALTER TABLE "TripStop" DROP CONSTRAINT "TripStop_tripId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_tripId_fkey";

-- DropForeignKey
ALTER TABLE "Pod" DROP CONSTRAINT "Pod_tripId_fkey";

-- DropForeignKey
ALTER TABLE "DriverAdvance" DROP CONSTRAINT "DriverAdvance_tripId_fkey";

-- DropForeignKey
ALTER TABLE "TripExpense" DROP CONSTRAINT "TripExpense_tripId_fkey";

-- DropForeignKey
ALTER TABLE "EodTally" DROP CONSTRAINT "EodTally_tripId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_clientId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceLine" DROP CONSTRAINT "InvoiceLine_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceLine" DROP CONSTRAINT "InvoiceLine_tripId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "LoginAttempt" DROP CONSTRAINT "LoginAttempt_userId_fkey";

-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "Client_code_key";

-- DropIndex
DROP INDEX "Vehicle_regNo_key";

-- DropIndex
DROP INDEX "Trip_tripCode_key";

-- DropIndex
DROP INDEX "Trip_status_hubId_idx";

-- DropIndex
DROP INDEX "TripStop_tripId_order_idx";

-- DropIndex
DROP INDEX "Invoice_invoiceNumber_key";

-- DropIndex
DROP INDEX "Invoice_clientId_createdAt_idx";

-- DropIndex
DROP INDEX "LoginAttempt_succeeded_createdAt_idx";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ADD COLUMN     "organizationId" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "lockedUntil" SET DATA TYPE TIMESTAMPTZ(6),
DROP COLUMN "clientId",
ADD COLUMN     "clientId" UUID,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_pkey",
ADD COLUMN     "organizationId" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID NOT NULL,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "revokedAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID NOT NULL,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "usedAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Client" DROP CONSTRAINT "Client_pkey",
ADD COLUMN     "organizationId" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "Client_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_pkey",
ADD COLUMN     "organizationId" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Driver" DROP CONSTRAINT "Driver_pkey",
ADD COLUMN     "organizationId" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "Driver_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_pkey",
DROP COLUMN "currentOdometer",
DROP COLUMN "hubId",
DROP COLUMN "shiftId",
DROP COLUMN "startOdometer",
DROP COLUMN "tripCode",
ADD COLUMN     "lrNumber" TEXT,
ADD COLUMN     "odometerEnd" INTEGER,
ADD COLUMN     "odometerStart" INTEGER,
ADD COLUMN     "organizationId" UUID NOT NULL,
ADD COLUMN     "tripNumber" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ASSIGNED',
DROP COLUMN "clientId",
ADD COLUMN     "clientId" UUID,
DROP COLUMN "driverId",
ADD COLUMN     "driverId" UUID,
DROP COLUMN "vehicleId",
ADD COLUMN     "vehicleId" UUID,
ALTER COLUMN "eta" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "Trip_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "TripStop" DROP CONSTRAINT "TripStop_pkey",
DROP COLUMN "order",
ADD COLUMN     "collectionType" "CollectionMode" DEFAULT 'COD',
ADD COLUMN     "deliveredQty" INTEGER,
ADD COLUMN     "expectedCollection" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "expectedQty" INTEGER,
ADD COLUMN     "organizationId" UUID NOT NULL,
ADD COLUMN     "sequence" INTEGER NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "tripId",
ADD COLUMN     "tripId" UUID NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Pod" DROP CONSTRAINT "Pod_pkey",
DROP COLUMN "designation",
DROP COLUMN "device",
DROP COLUMN "gpsAccuracyPercent",
ADD COLUMN     "organizationId" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "tripId",
ADD COLUMN     "tripId" UUID NOT NULL,
ALTER COLUMN "gateInTimestamp" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "Pod_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "TripExpense" DROP CONSTRAINT "TripExpense_pkey",
ADD COLUMN     "note" TEXT,
ADD COLUMN     "organizationId" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "tripId",
ADD COLUMN     "tripId" UUID NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "ExpenseType" NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "TripExpense_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "EodTally" DROP CONSTRAINT "EodTally_pkey",
DROP COLUMN "advance",
ADD COLUMN     "organizationId" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "tripId",
ADD COLUMN     "tripId" UUID NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "EodTally_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AuditReview" DROP CONSTRAINT "AuditReview_pkey",
DROP COLUMN "auditorId",
DROP COLUMN "decision",
DROP COLUMN "gateCash",
DROP COLUMN "gateDistance",
DROP COLUMN "gateDoc",
DROP COLUMN "gateSignature",
DROP COLUMN "gateStamp",
DROP COLUMN "slaDueAt",
ADD COLUMN     "checklist" JSONB,
ADD COLUMN     "organizationId" UUID NOT NULL,
ADD COLUMN     "outcome" "AuditOutcome" NOT NULL,
ADD COLUMN     "reviewerId" UUID,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "tripId",
ADD COLUMN     "tripId" UUID NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "AuditReview_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_pkey",
DROP COLUMN "gst",
ADD COLUMN     "gstAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gstRate" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "organizationId" UUID NOT NULL,
ADD COLUMN     "periodEnd" TIMESTAMPTZ(6),
ADD COLUMN     "periodStart" TIMESTAMPTZ(6),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "clientId",
ADD COLUMN     "clientId" UUID,
ALTER COLUMN "issueDate" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "dueDate" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "InvoiceLine" DROP CONSTRAINT "InvoiceLine_pkey",
ADD COLUMN     "organizationId" UUID NOT NULL,
ADD COLUMN     "snapshot" JSONB,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "invoiceId",
ADD COLUMN     "invoiceId" UUID NOT NULL,
DROP COLUMN "tripId",
ADD COLUMN     "tripId" UUID NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_pkey",
ADD COLUMN     "organizationId" UUID NOT NULL,
ADD COLUMN     "reference" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "invoiceId",
ADD COLUMN     "invoiceId" UUID NOT NULL,
ALTER COLUMN "paidAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "Payment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_pkey",
ADD COLUMN     "organizationId" UUID NOT NULL,
ADD COLUMN     "payload" JSONB,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID,
ALTER COLUMN "readAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_pkey",
ADD COLUMN     "organizationId" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "actorId",
ADD COLUMN     "actorId" UUID,
DROP COLUMN "entityId",
ADD COLUMN     "entityId" UUID NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "IdempotencyKey" DROP CONSTRAINT "IdempotencyKey_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "LoginAttempt" DROP CONSTRAINT "LoginAttempt_pkey",
ADD COLUMN     "organizationId" UUID,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "Hub";

-- DropTable
DROP TABLE "Shift";

-- DropTable
DROP TABLE "LorryReceipt";

-- DropTable
DROP TABLE "DriverAdvance";

-- DropTable
DROP TABLE "SystemAlert";

-- DropTable
DROP TABLE "InvoiceSequence";

-- DropEnum
DROP TYPE "AlertSeverity";

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "stateCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),
    "invitedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Counter_organizationId_idx" ON "Counter"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_organizationId_entityType_period_key" ON "Counter"("organizationId", "entityType", "period");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- CreateIndex
CREATE INDEX "RefreshToken_organizationId_idx" ON "RefreshToken"("organizationId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_organizationId_code_key" ON "Client"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Vehicle_organizationId_idx" ON "Vehicle"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_organizationId_regNo_key" ON "Vehicle"("organizationId", "regNo");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE INDEX "Driver_organizationId_idx" ON "Driver"("organizationId");

-- CreateIndex
CREATE INDEX "Trip_organizationId_idx" ON "Trip"("organizationId");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_organizationId_tripNumber_key" ON "Trip"("organizationId", "tripNumber");

-- CreateIndex
CREATE INDEX "TripStop_organizationId_idx" ON "TripStop"("organizationId");

-- CreateIndex
CREATE INDEX "TripStop_tripId_sequence_idx" ON "TripStop"("tripId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Pod_tripId_key" ON "Pod"("tripId");

-- CreateIndex
CREATE INDEX "Pod_organizationId_idx" ON "Pod"("organizationId");

-- CreateIndex
CREATE INDEX "TripExpense_organizationId_idx" ON "TripExpense"("organizationId");

-- CreateIndex
CREATE INDEX "TripExpense_tripId_idx" ON "TripExpense"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "EodTally_tripId_key" ON "EodTally"("tripId");

-- CreateIndex
CREATE INDEX "EodTally_organizationId_idx" ON "EodTally"("organizationId");

-- CreateIndex
CREATE INDEX "AuditReview_organizationId_idx" ON "AuditReview"("organizationId");

-- CreateIndex
CREATE INDEX "AuditReview_tripId_idx" ON "AuditReview"("tripId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_invoiceNumber_key" ON "Invoice"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_tripId_key" ON "InvoiceLine"("tripId");

-- CreateIndex
CREATE INDEX "InvoiceLine_organizationId_idx" ON "InvoiceLine"("organizationId");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "LoginAttempt_userId_createdAt_idx" ON "LoginAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_organizationId_idx" ON "LoginAttempt"("organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripExpense" ADD CONSTRAINT "TripExpense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripExpense" ADD CONSTRAINT "TripExpense_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EodTally" ADD CONSTRAINT "EodTally_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EodTally" ADD CONSTRAINT "EodTally_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReview" ADD CONSTRAINT "AuditReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReview" ADD CONSTRAINT "AuditReview_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
