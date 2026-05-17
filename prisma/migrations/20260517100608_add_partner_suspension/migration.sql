-- CreateTable "PartnerSuspension"
CREATE TABLE "PartnerSuspension" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partnerId" TEXT,
    "partnerName" TEXT NOT NULL,
    "partnerRole" TEXT NOT NULL,
    "suspensionStatus" TEXT NOT NULL DEFAULT 'SUSPENDED',
    "suspensionReason" TEXT NOT NULL,
    "reasonDetails" JSONB,
    "suspendedAt" TIMESTAMPTZ(6) NOT NULL,
    "suspendedByAdminId" TEXT,
    "appealedAt" TIMESTAMPTZ(6),
    "appealMessage" TEXT,
    "resolvedAt" TIMESTAMPTZ(6),
    "resolutionNotes" TEXT,
    "contractRef" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PartnerSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSuspension_organizationId_partnerId_key" ON "PartnerSuspension"("organizationId", "partnerId");

-- CreateIndex
CREATE INDEX "PartnerSuspension_organizationId_suspensionStatus_idx" ON "PartnerSuspension"("organizationId", "suspensionStatus");

-- CreateIndex
CREATE INDEX "PartnerSuspension_suspendedAt_idx" ON "PartnerSuspension"("suspendedAt");

-- CreateIndex
CREATE INDEX "PartnerSuspension_resolvedAt_idx" ON "PartnerSuspension"("resolvedAt");

-- AddForeignKey
ALTER TABLE "PartnerSuspension" ADD CONSTRAINT "PartnerSuspension_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
