-- Add foreign key relations from AffiliateSale to AffiliateProfile (manager and agent)

-- Add managerId foreign key relation to AffiliateProfile
ALTER TABLE "AffiliateSale" ADD CONSTRAINT "AffiliateSale_managerIdToAffiliateProfile_fk" FOREIGN KEY ("managerId") REFERENCES "AffiliateProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add agentId foreign key relation to AffiliateProfile
ALTER TABLE "AffiliateSale" ADD CONSTRAINT "AffiliateSale_agentIdToAffiliateProfile_fk" FOREIGN KEY ("agentId") REFERENCES "AffiliateProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
