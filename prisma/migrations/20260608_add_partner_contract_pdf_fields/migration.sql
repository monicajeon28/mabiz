-- AlterTable
ALTER TABLE "PartnerContract"
ADD COLUMN "contractDocumentUrl" TEXT,
ADD COLUMN "contractDriveFileId" TEXT,
ADD COLUMN "contractDriveFolderId" TEXT,
ADD COLUMN "contractSignedAt" TIMESTAMPTZ,
ADD COLUMN "signatureImageUrl" TEXT,
ADD COLUMN "contractSignatureFileId" TEXT,
ADD COLUMN "contractStatus" TEXT NOT NULL DEFAULT 'DRAFT';

-- Create indexes for efficient querying
CREATE INDEX "idx_partner_contract_signed_at" ON "PartnerContract"("contractSignedAt");
CREATE INDEX "idx_partner_contract_status" ON "PartnerContract"("contractStatus");
