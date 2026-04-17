-- CreateTable
CREATE TABLE "MemberDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "note" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "MemberDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberDocument_organizationId_idx" ON "MemberDocument"("organizationId");

-- CreateIndex
CREATE INDEX "MemberDocument_userId_idx" ON "MemberDocument"("userId");

-- CreateIndex
CREATE INDEX "MemberDocument_organizationId_userId_idx" ON "MemberDocument"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "MemberDocument" ADD CONSTRAINT "MemberDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
