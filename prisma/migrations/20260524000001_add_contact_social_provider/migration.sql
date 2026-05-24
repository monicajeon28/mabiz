-- AlterTable: Contact에 소셜 로그인 제공자 필드 추가
-- 크루즈닷몰 GmUser.socialProvider와 연동하여 purchase 웹훅 처리 시 자동 저장
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "socialProvider" VARCHAR(20);

-- Index: 조직별 소셜 채널 필터링 최적화
CREATE INDEX IF NOT EXISTS "idx_contact_org_social_provider" ON "Contact"("organizationId", "socialProvider");
