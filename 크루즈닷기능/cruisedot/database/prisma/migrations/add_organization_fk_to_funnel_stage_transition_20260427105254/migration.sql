-- AddOrganizationForeignKeyToFunnelStageTransition
ALTER TABLE "FunnelStageTransition"
ADD CONSTRAINT "FunnelStageTransition_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id") ON DELETE CASCADE;
