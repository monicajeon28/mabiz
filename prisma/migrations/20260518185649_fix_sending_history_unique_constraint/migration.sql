-- Phase 2 P0 Blocker 3: SendingHistory 부분적 Unique 제약 보강
-- 기존: 캠페인 기반 발송만 중복 방지 (수동 발송은 중복 가능)
-- 개선: campaignId가 있을 때만 중복 방지 (WHERE 조건)

-- 1. 기존 unique 제약 제거
ALTER TABLE "SendingHistory" DROP CONSTRAINT IF EXISTS "unique_sending_history_campaign_contact";

-- 2. 조건부 Unique 인덱스 생성 (campaignId가 NOT NULL일 때만)
CREATE UNIQUE INDEX IF NOT EXISTS ix_sending_history_dedup
ON "SendingHistory" ("campaignId", "contactId")
WHERE "campaignId" IS NOT NULL;
