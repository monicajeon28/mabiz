-- OrgSmsConfig: 발신번호 인증 관련 컬럼 추가
ALTER TABLE "OrgSmsConfig" ADD COLUMN IF NOT EXISTS "senderVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrgSmsConfig" ADD COLUMN IF NOT EXISTS "verifiedAt"     TIMESTAMP WITH TIME ZONE;
ALTER TABLE "OrgSmsConfig" ADD COLUMN IF NOT EXISTS "arsNum"         TEXT;
