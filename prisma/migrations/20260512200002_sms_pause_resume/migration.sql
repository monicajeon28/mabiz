-- ScheduledSms: 일시정지/재발송 지원 필드
ALTER TABLE "ScheduledSms" ADD COLUMN IF NOT EXISTS "pausedAt"      TIMESTAMP(3);
ALTER TABLE "ScheduledSms" ADD COLUMN IF NOT EXISTS "pausedBy"      TEXT;
ALTER TABLE "ScheduledSms" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

-- VipCareSequence: 일시정지 지원 필드
ALTER TABLE "VipCareSequence" ADD COLUMN IF NOT EXISTS "pausedAt"   TIMESTAMP(3);
ALTER TABLE "VipCareSequence" ADD COLUMN IF NOT EXISTS "pausedBy"   TEXT;
