-- AddLensSignalLog
CREATE TABLE IF NOT EXISTS "LensSignalLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contactId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "signalName" VARCHAR(100) NOT NULL,
  "signalValue" TEXT,
  "calculatedPoints" INTEGER NOT NULL DEFAULT 0,
  "lensType" VARCHAR(3),
  "detectedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE,
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_lens_signal_log_contact_id" ON "LensSignalLog"("contactId");
CREATE INDEX "idx_lens_signal_log_organization_id" ON "LensSignalLog"("organizationId");
CREATE INDEX "idx_lens_signal_log_lens_type" ON "LensSignalLog"("lensType");
CREATE INDEX "idx_lens_signal_log_detected_at" ON "LensSignalLog"("detectedAt");
