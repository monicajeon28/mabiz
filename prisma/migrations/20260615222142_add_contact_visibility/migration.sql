-- AddColumn: Contact.visibility
ALTER TABLE "Contact" ADD COLUMN "visibility" VARCHAR(20) NOT NULL DEFAULT 'SHARED';

-- AddColumn: Contact.createdBy
ALTER TABLE "Contact" ADD COLUMN "createdBy" TEXT;

-- AddColumn: Contact.managerId
ALTER TABLE "Contact" ADD COLUMN "managerId" TEXT;

-- AddIndex: Contact(organizationId, visibility) for permission filtering
CREATE INDEX "idx_contact_org_visibility" ON "Contact"("organizationId", "visibility");

-- AddIndex: Contact(organizationId, createdBy) for creator tracking
CREATE INDEX "idx_contact_org_created_by" ON "Contact"("organizationId", "createdBy");

-- AddIndex: Contact(organizationId, managerId) for manager filtering
CREATE INDEX "idx_contact_org_manager_id" ON "Contact"("organizationId", "managerId");

-- Backfill: Set createdBy = assignedUserId for existing records (where available)
UPDATE "Contact"
SET "createdBy" = "assignedUserId"
WHERE "createdBy" IS NULL AND "assignedUserId" IS NOT NULL;

-- Update visibility for records without createdBy (set to SHARED for backward compatibility)
UPDATE "Contact"
SET "visibility" = 'SHARED'
WHERE "visibility" IS NULL;
