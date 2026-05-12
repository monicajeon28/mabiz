-- Add unique constraint on leadId to PassportUploadToken
-- P1-8: 고객당 토큰 1개만 (덮어쓰기 허용)

ALTER TABLE "PassportUploadToken" ADD CONSTRAINT "PassportUploadToken_leadId_key" UNIQUE ("leadId");
