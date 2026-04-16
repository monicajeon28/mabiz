-- CreateTable: SalesDocument
CREATE TABLE "SalesDocument" (
    "id"              TEXT NOT NULL,
    "organizationId"  TEXT NOT NULL,
    "documentType"    TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'DRAFT',
    "orderId"         TEXT,
    "affiliateSaleId" TEXT,
    "contactId"       TEXT,
    "generatedData"   JSONB NOT NULL,
    "filePath"        TEXT,
    "approvedBy"      TEXT,
    "approvedAt"      TIMESTAMP(3),
    "rejectedReason"  TEXT,
    "createdBy"       TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SalesDocumentApproval
CREATE TABLE "SalesDocumentApproval" (
    "id"             TEXT NOT NULL,
    "documentId"     TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedBy"    TEXT NOT NULL,
    "approvedBy"     TEXT,
    "status"         TEXT NOT NULL DEFAULT 'PENDING',
    "requestNote"    TEXT,
    "adminNote"      TEXT,
    "processedAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDocumentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesDocument_organizationId_documentType_idx" ON "SalesDocument"("organizationId", "documentType");
CREATE INDEX "SalesDocument_organizationId_status_idx" ON "SalesDocument"("organizationId", "status");
CREATE INDEX "SalesDocument_orderId_idx" ON "SalesDocument"("orderId");

-- CreateIndex
CREATE INDEX "SalesDocumentApproval_organizationId_status_idx" ON "SalesDocumentApproval"("organizationId", "status");
CREATE INDEX "SalesDocumentApproval_documentId_idx" ON "SalesDocumentApproval"("documentId");

-- AddForeignKey
ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_affiliateSaleId_fkey"
    FOREIGN KEY ("affiliateSaleId") REFERENCES "AffiliateSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocumentApproval" ADD CONSTRAINT "SalesDocumentApproval_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "SalesDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesDocumentApproval" ADD CONSTRAINT "SalesDocumentApproval_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
