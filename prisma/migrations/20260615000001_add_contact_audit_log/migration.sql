-- CreateTable ContactAuditLog
CREATE TABLE "ContactAuditLog" (
    "id"             TEXT NOT NULL,
    "contactId"      TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId"         TEXT,
    "action"         TEXT NOT NULL,
    "fieldChanged"   TEXT,
    "oldValue"       TEXT,
    "newValue"       TEXT,
    "reason"         TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactAuditLog_contactId_idx" ON "ContactAuditLog"("contactId");
CREATE INDEX "ContactAuditLog_organizationId_idx" ON "ContactAuditLog"("organizationId");
CREATE INDEX "ContactAuditLog_createdAt_idx" ON "ContactAuditLog"("createdAt");
CREATE INDEX "ContactAuditLog_action_idx" ON "ContactAuditLog"("action");

-- AddForeignKey
ALTER TABLE "ContactAuditLog" ADD CONSTRAINT "ContactAuditLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactAuditLog" ADD CONSTRAINT "ContactAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
