-- Add adminId column to RefundPolicyGroup
ALTER TABLE "RefundPolicyGroup" ADD COLUMN "adminId" INTEGER NOT NULL DEFAULT 1;

-- Add adminId column to InclusionExclusionGroup
ALTER TABLE "InclusionExclusionGroup" ADD COLUMN "adminId" INTEGER NOT NULL DEFAULT 1;

-- Create indexes for adminId
CREATE INDEX "RefundPolicyGroup_adminId_idx" ON "RefundPolicyGroup"("adminId");
CREATE INDEX "InclusionExclusionGroup_adminId_idx" ON "InclusionExclusionGroup"("adminId");

-- Add foreign key constraints
ALTER TABLE "RefundPolicyGroup" ADD CONSTRAINT "RefundPolicyGroup_adminId_fkey" 
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE;
  
ALTER TABLE "InclusionExclusionGroup" ADD CONSTRAINT "InclusionExclusionGroup_adminId_fkey" 
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE;
