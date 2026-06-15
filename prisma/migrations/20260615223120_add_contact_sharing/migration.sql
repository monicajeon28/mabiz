-- CreateEnum
CREATE TYPE "ContactVisibility" AS ENUM ('SHARED', 'ADMIN_ONLY');

-- CreateTable
CREATE TABLE "ContactSharing" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sharedBy" TEXT NOT NULL,
    "sharedTo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactSharing_pkey" PRIMARY KEY ("id")
);

-- Add relation from Contact to ContactSharing
ALTER TABLE "ContactSharing" ADD CONSTRAINT "ContactSharing_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "ContactSharing_contactId_sharedBy_sharedTo_key" ON "ContactSharing"("contactId", "sharedBy", "sharedTo");

-- CreateIndex
CREATE INDEX "ContactSharing_contactId_idx" ON "ContactSharing"("contactId");

-- CreateIndex
CREATE INDEX "ContactSharing_sharedTo_idx" ON "ContactSharing"("sharedTo");
