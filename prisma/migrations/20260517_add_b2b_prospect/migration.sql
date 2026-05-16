-- CreateTable
CREATE TABLE "B2BProspect" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eduType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "productName" TEXT,
    "paymentAmount" INTEGER,
    "paymentDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "B2BProspect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "B2BProspect_organizationId_phone_eduType_key" ON "B2BProspect"("organizationId", "phone", "eduType") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "B2BProspect_organizationId_createdAt_idx" ON "B2BProspect"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "B2BProspect_organizationId_eduType_idx" ON "B2BProspect"("organizationId", "eduType");

-- AddForeignKey
ALTER TABLE "B2BProspect" ADD CONSTRAINT "B2BProspect_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
