-- ANALYTICS-EMAIL-DUP: CrmMarketingMessage.channel 추가
-- 채널별 성과 집계에서 EMAIL이 SMS와 동일 집계되던 버그 해소용.
-- NOT NULL DEFAULT 'SMS' → 기존 행은 자동 'SMS' 백필(이 테이블은 SMS 자동화 로그).
-- IF NOT EXISTS: 이미 수동 적용(scripts/apply-marketing-channel.mjs)된 DB에서도 안전한 no-op.
ALTER TABLE "CrmMarketingMessage" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'SMS';
