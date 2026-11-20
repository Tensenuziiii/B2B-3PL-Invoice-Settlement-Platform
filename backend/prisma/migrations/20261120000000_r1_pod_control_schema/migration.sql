-- 1. Alter Enum Role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VIEWER';

-- 2. Alter Enum TripStatus
ALTER TYPE "TripStatus" ADD VALUE IF NOT EXISTS 'PLACED';
ALTER TYPE "TripStatus" ADD VALUE IF NOT EXISTS 'LOADING';
ALTER TYPE "TripStatus" ADD VALUE IF NOT EXISTS 'LOADED';
ALTER TYPE "TripStatus" ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE "TripStatus" ADD VALUE IF NOT EXISTS 'UNLOADING';
ALTER TYPE "TripStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "TripStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "TripStatus" ADD VALUE IF NOT EXISTS 'VEHICLE_REPLACED';

-- 3. Create Enum PodStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PodStatus') THEN
    CREATE TYPE "PodStatus" AS ENUM (
      'PENDING_DELIVERY',
      'SOFT_COPY_RECEIVED',
      'SOFT_COPY_CHECKED',
      'ORIGINAL_DISPATCHED',
      'ORIGINAL_RECEIVED',
      'SUBMITTED_TO_CLIENT',
      'ON_HOLD',
      'LOST',
      'DUPLICATE_REQUESTED',
      'ACKNOWLEDGED'
    );
  END IF;
END$$;

-- 4. Alter Enum InvoiceStatus
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'IN_STAGE';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'APPROVED_STAGE';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'FULLY_APPROVED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

-- 5. Alter Client Table
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "creditDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "digitalPodEnabled" BOOLEAN NOT NULL DEFAULT false;

-- 6. Create CustomerContact Table
CREATE TABLE IF NOT EXISTS "CustomerContact" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CustomerContact_organizationId_idx" ON "CustomerContact"("organizationId");
CREATE INDEX IF NOT EXISTS "CustomerContact_clientId_idx" ON "CustomerContact"("clientId");

-- 7. Create ApprovalStageTemplate Table
CREATE TABLE IF NOT EXISTS "ApprovalStageTemplate" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "slaHours" INTEGER NOT NULL DEFAULT 48,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalStageTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApprovalStageTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ApprovalStageTemplate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalStageTemplate_clientId_sequence_key" ON "ApprovalStageTemplate"("clientId", "sequence");
CREATE INDEX IF NOT EXISTS "ApprovalStageTemplate_organizationId_idx" ON "ApprovalStageTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "ApprovalStageTemplate_clientId_idx" ON "ApprovalStageTemplate"("clientId");

-- 8. Create CustomerDocumentRule Table
CREATE TABLE IF NOT EXISTS "CustomerDocumentRule" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "documentType" TEXT NOT NULL,
  "isMandatory" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerDocumentRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerDocumentRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerDocumentRule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerDocumentRule_clientId_documentType_key" ON "CustomerDocumentRule"("clientId", "documentType");
CREATE INDEX IF NOT EXISTS "CustomerDocumentRule_organizationId_idx" ON "CustomerDocumentRule"("organizationId");
CREATE INDEX IF NOT EXISTS "CustomerDocumentRule_clientId_idx" ON "CustomerDocumentRule"("clientId");

-- 9. Create Owner Table
CREATE TABLE IF NOT EXISTS "Owner" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "partyType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  "pan" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ(6),
  CONSTRAINT "Owner_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Owner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Owner_organizationId_name_key" ON "Owner"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "Owner_organizationId_idx" ON "Owner"("organizationId");
CREATE INDEX IF NOT EXISTS "Owner_organizationId_pan_idx" ON "Owner"("organizationId", "pan");

-- 10. Alter Vehicle Table
ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS "ownerId" UUID,
  ADD COLUMN IF NOT EXISTS "insuranceExpiry" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "fitnessExpiry" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "pucExpiry" TIMESTAMPTZ(6);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vehicle_ownerId_fkey') THEN
    ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- 11. Alter Driver Table
ALTER TABLE "Driver"
  ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT DEFAULT 'VERIFIED';

-- 12. Alter Trip Table
ALTER TABLE "Trip"
  ADD COLUMN IF NOT EXISTS "ownerId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trip_ownerId_fkey') THEN
    ALTER TABLE "Trip" ADD CONSTRAINT "Trip_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- 13. Create TripStatusEvent Table
CREATE TABLE IF NOT EXISTS "TripStatusEvent" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "tripId" UUID NOT NULL,
  "fromStatus" TEXT NOT NULL,
  "toStatus" TEXT NOT NULL,
  "actorId" UUID,
  "reason" TEXT,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripStatusEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripStatusEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TripStatusEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TripStatusEvent_organizationId_idx" ON "TripStatusEvent"("organizationId");
CREATE INDEX IF NOT EXISTS "TripStatusEvent_tripId_occurredAt_idx" ON "TripStatusEvent"("tripId", "occurredAt");

-- 14. Create TripException Table
CREATE TABLE IF NOT EXISTS "TripException" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "tripId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" UUID,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripException_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripException_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TripException_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TripException_organizationId_idx" ON "TripException"("organizationId");
CREATE INDEX IF NOT EXISTS "TripException_tripId_idx" ON "TripException"("tripId");

-- 15. Create TripAssignmentHistory Table
CREATE TABLE IF NOT EXISTS "TripAssignmentHistory" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "tripId" UUID NOT NULL,
  "previousVehicleId" UUID,
  "newVehicleId" UUID,
  "previousDriverId" UUID,
  "newDriverId" UUID,
  "reason" TEXT,
  "reminderPartB" BOOLEAN NOT NULL DEFAULT false,
  "changedById" UUID,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripAssignmentHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripAssignmentHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TripAssignmentHistory_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TripAssignmentHistory_previousVehicleId_fkey" FOREIGN KEY ("previousVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TripAssignmentHistory_newVehicleId_fkey" FOREIGN KEY ("newVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TripAssignmentHistory_previousDriverId_fkey" FOREIGN KEY ("previousDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TripAssignmentHistory_newDriverId_fkey" FOREIGN KEY ("newDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TripAssignmentHistory_organizationId_idx" ON "TripAssignmentHistory"("organizationId");
CREATE INDEX IF NOT EXISTS "TripAssignmentHistory_tripId_idx" ON "TripAssignmentHistory"("tripId");

-- 16. Create Pod Table
CREATE TABLE IF NOT EXISTS "Pod" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "tripId" UUID NOT NULL,
  "currentStatus" "PodStatus" NOT NULL DEFAULT 'PENDING_DELIVERY',
  "deliveredAt" TIMESTAMPTZ(6),
  "originalReceivedAt" TIMESTAMPTZ(6),
  "holdReason" TEXT,
  "holdRemarks" TEXT,
  "courierName" TEXT,
  "courierTrackingNo" TEXT,
  "courierDispatchedAt" TIMESTAMPTZ(6),
  "submittedToClientAt" TIMESTAMPTZ(6),
  "invoiceId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Pod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Pod_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Pod_tripId_key" ON "Pod"("tripId");
CREATE UNIQUE INDEX IF NOT EXISTS "Pod_invoiceId_key" ON "Pod"("invoiceId");
CREATE INDEX IF NOT EXISTS "Pod_organizationId_idx" ON "Pod"("organizationId");
CREATE INDEX IF NOT EXISTS "Pod_currentStatus_idx" ON "Pod"("currentStatus");

-- 17. Create PodCheckItem Table
CREATE TABLE IF NOT EXISTS "PodCheckItem" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "podId" UUID NOT NULL,
  "itemCode" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "notes" TEXT,
  "checkedById" UUID,
  "checkedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PodCheckItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PodCheckItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PodCheckItem_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PodCheckItem_podId_itemCode_key" ON "PodCheckItem"("podId", "itemCode");
CREATE INDEX IF NOT EXISTS "PodCheckItem_organizationId_idx" ON "PodCheckItem"("organizationId");
CREATE INDEX IF NOT EXISTS "PodCheckItem_podId_idx" ON "PodCheckItem"("podId");

-- 18. Create PodEvent Table
CREATE TABLE IF NOT EXISTS "PodEvent" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "podId" UUID NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "actorId" UUID,
  "reason" TEXT,
  "remarks" TEXT,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PodEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PodEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PodEvent_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PodEvent_organizationId_idx" ON "PodEvent"("organizationId");
CREATE INDEX IF NOT EXISTS "PodEvent_podId_occurredAt_idx" ON "PodEvent"("podId", "occurredAt");

-- 19. Alter Invoice Table & foreign keys
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "podId" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_podId_key" ON "Invoice"("podId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_podId_fkey') THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- 20. Create InvoiceStage Table
CREATE TABLE IF NOT EXISTS "InvoiceStage" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedById" UUID,
  "approvedAt" TIMESTAMPTZ(6),
  "remarks" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceStage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceStage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InvoiceStage_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceStage_invoiceId_sequence_key" ON "InvoiceStage"("invoiceId", "sequence");
CREATE INDEX IF NOT EXISTS "InvoiceStage_organizationId_idx" ON "InvoiceStage"("organizationId");
CREATE INDEX IF NOT EXISTS "InvoiceStage_invoiceId_idx" ON "InvoiceStage"("invoiceId");

-- 21. Create InvoiceFollowUp Table
CREATE TABLE IF NOT EXISTS "InvoiceFollowUp" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "contactedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contactPerson" TEXT,
  "outcome" TEXT NOT NULL,
  "remarks" TEXT,
  "nextFollowUpOn" TIMESTAMPTZ(6),
  "loggedById" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceFollowUp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceFollowUp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InvoiceFollowUp_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "InvoiceFollowUp_organizationId_idx" ON "InvoiceFollowUp"("organizationId");
CREATE INDEX IF NOT EXISTS "InvoiceFollowUp_invoiceId_idx" ON "InvoiceFollowUp"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceFollowUp_nextFollowUpOn_idx" ON "InvoiceFollowUp"("nextFollowUpOn");

-- 22. Create AuditEvent Table
CREATE TABLE IF NOT EXISTS "AuditEvent" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "userId" UUID,
  "entityType" TEXT NOT NULL,
  "entityId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditEvent_organizationId_idx" ON "AuditEvent"("organizationId");
CREATE INDEX IF NOT EXISTS "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditEvent_userId_idx" ON "AuditEvent"("userId");
