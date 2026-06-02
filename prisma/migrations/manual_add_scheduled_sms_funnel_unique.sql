-- Migration: add_scheduled_sms_funnel_unique
-- 목적: 퍼널문자(FunnelSms) 중복 INSERT 레이스 컨디션 방지 (P1-2)
-- 실행 방법: Neon 대시보드 → SQL Editor에 붙여넣기 후 실행
--
-- ⚠️ 중요 — SOP 수정 사유:
--   당초 SOP는 (organizationId, contactId, channel) 전역 @@unique 를 제안했으나,
--   실제 코드에는 ScheduledSms를 생성하는 경로가 다수 존재하며
--   상수 channel 값('SMS','EMAIL','GROUP','DAY0_SEQUENCE' 등)을
--   동일 contact에 반복 INSERT 하는 정상 흐름이 있다.
--   전역 UNIQUE를 걸면 이들 정상 발송이 skipDuplicates로 조용히 누락된다.
--
--   따라서 퍼널문자 채널(FUNNEL_SMS:funnelSmsId:msgId)에만 적용되는
--   "부분 UNIQUE 인덱스(partial unique index)"로 한정한다.
--   - 퍼널 채널은 행마다 고유(msgId 포함)하므로 정상 흐름을 막지 않는다.
--   - 동일 funnel을 동시 트리거(레이스)하면 동일 channel 문자열이 생성되어
--     UNIQUE 위반 → skipDuplicates로 무시 → 2중 발송 차단.

-- 1) 기존 중복 정리 (퍼널 채널 한정, PENDING/SENT 중 가장 오래된 1건만 유지)
--    contactId가 NULL인 행은 대상에서 제외(퍼널 트리거는 항상 contactId 설정).
DELETE FROM "ScheduledSms" s1
USING "ScheduledSms" s2
WHERE s1."channel" LIKE 'FUNNEL_SMS:%'
  AND s2."channel" LIKE 'FUNNEL_SMS:%'
  AND s1."organizationId" = s2."organizationId"
  AND s1."contactId" IS NOT NULL
  AND s1."contactId" = s2."contactId"
  AND s1."channel" = s2."channel"
  AND s1."id" > s2."id";

-- 2) 부분 UNIQUE 인덱스 생성 (퍼널 채널 + contactId NOT NULL 한정)
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_scheduled_sms_funnel_channel"
  ON "ScheduledSms" ("organizationId", "contactId", "channel")
  WHERE "channel" LIKE 'FUNNEL_SMS:%' AND "contactId" IS NOT NULL;

-- 3) 확인 쿼리
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'ScheduledSms'
  AND indexname = 'uniq_scheduled_sms_funnel_channel';
