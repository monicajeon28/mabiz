-- 계약서 필드 추가 마이그레이션
-- 작성일: 2025-01-28

-- AffiliateContract 테이블에 계약 시작일/종료일 및 싸인 링크 필드 추가
ALTER TABLE "AffiliateContract" 
ADD COLUMN IF NOT EXISTS "contractStartDate" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "contractEndDate" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "signatureLink" TEXT,
ADD COLUMN IF NOT EXISTS "signatureLinkExpiresAt" TIMESTAMP;

-- 인덱스는 필요시 추가
-- 예: 싸인 링크 만료일 기준 조회 최적화
-- CREATE INDEX IF NOT EXISTS "idx_affiliate_contract_signature_link_expires" 
-- ON "AffiliateContract"("signatureLinkExpiresAt") 
-- WHERE "signatureLink" IS NOT NULL;


