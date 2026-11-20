-- CreateTable
CREATE TABLE "Route" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "expectedKm" INTEGER NOT NULL,
    "standardTollEstimate" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Route_organizationId_idx" ON "Route"("organizationId");

-- CreateIndex
CREATE INDEX "Route_organizationId_status_idx" ON "Route"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Route_organizationId_name_key" ON "Route"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
