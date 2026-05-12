-- Add gold membership authentication fields to User table
ALTER TABLE "User" ADD COLUMN "grade" VARCHAR(50) NOT NULL DEFAULT 'regular';
ALTER TABLE "User" ADD COLUMN "isPasswordSet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "goldMemberId" INTEGER UNIQUE;

-- Add userId and membershipCode to GoldMember table
ALTER TABLE "GoldMember" ADD COLUMN "userId" INTEGER UNIQUE;
ALTER TABLE "GoldMember" ADD COLUMN "membershipCode" VARCHAR(255) UNIQUE;
ALTER TABLE "GoldMember" ADD COLUMN "deletedAt" TIMESTAMP;
ALTER TABLE "GoldMember" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add updatedAt to GoldMembershipCode if not exists
ALTER TABLE "GoldMembershipCode" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create indexes on GoldMember
CREATE INDEX IF NOT EXISTS "GoldMember_userId_idx" ON "GoldMember"("userId");
CREATE INDEX IF NOT EXISTS "GoldMember_membershipCode_idx" ON "GoldMember"("membershipCode");
CREATE INDEX IF NOT EXISTS "GoldMember_deletedAt_idx" ON "GoldMember"("deletedAt");

-- Create indexes on GoldMembershipCode
CREATE INDEX IF NOT EXISTS "GoldMembershipCode_createdById_idx" ON "GoldMembershipCode"("createdById");
CREATE INDEX IF NOT EXISTS "GoldMembershipCode_expiresAt_idx" ON "GoldMembershipCode"("expiresAt");

-- Add foreign key constraints if not exists
ALTER TABLE "User" ADD CONSTRAINT "User_goldMemberId_fkey" 
  FOREIGN KEY ("goldMemberId") REFERENCES "GoldMember"("id") ON DELETE SET NULL;

ALTER TABLE "GoldMember" ADD CONSTRAINT "GoldMember_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "GoldMembershipCode" ADD CONSTRAINT "GoldMembershipCode_createdById_fkey" 
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "GoldMembershipCode" ADD CONSTRAINT "GoldMembershipCode_usedByUserId_fkey" 
  FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL;
