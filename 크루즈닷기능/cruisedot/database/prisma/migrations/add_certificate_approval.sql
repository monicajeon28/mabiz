-- CreateTable: CertificateApproval
CREATE TABLE IF NOT EXISTS "CertificateApproval" (
    "id" SERIAL NOT NULL,
    "certificateType" TEXT NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "requesterType" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "birthDate" TEXT,
    "productName" TEXT NOT NULL,
    "paymentAmount" INTEGER NOT NULL,
    "paymentDate" TEXT NOT NULL,
    "refundAmount" INTEGER,
    "refundDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" INTEGER,
    "approvedByType" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CertificateApproval_requesterId_status_createdAt_idx" ON "CertificateApproval"("requesterId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CertificateApproval_customerId_certificateType_idx" ON "CertificateApproval"("customerId", "certificateType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CertificateApproval_status_createdAt_idx" ON "CertificateApproval"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CertificateApproval_approvedBy_createdAt_idx" ON "CertificateApproval"("approvedBy", "createdAt");

-- AddForeignKey
ALTER TABLE "CertificateApproval" ADD CONSTRAINT "CertificateApproval_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateApproval" ADD CONSTRAINT "CertificateApproval_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateApproval" ADD CONSTRAINT "CertificateApproval_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;






















