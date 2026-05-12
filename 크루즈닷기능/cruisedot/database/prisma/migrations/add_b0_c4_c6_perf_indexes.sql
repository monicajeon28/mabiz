-- B0-C4: CruiseProduct ILIKE 검색 성능 개선 — GIN trigram 인덱스 추가
-- B0-C6: ScheduledMessageLog channel 컬럼 추가 — groupBy 쿼리 지원
-- 작성일: 2026-04-28

-- ============================================
-- B0-C4: pg_trgm 확장 (없으면 생성)
-- ILIKE / 부분 문자열 검색: destination, shipName, packageName
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- destination ILIKE 검색 (region 필터)
CREATE INDEX IF NOT EXISTS "idx_cruise_product_destination_trgm"
  ON "CruiseProduct" USING GIN ("destination" gin_trgm_ops);

-- shipName ILIKE 검색 (keyword 검색)
CREATE INDEX IF NOT EXISTS "idx_cruise_product_shipname_trgm"
  ON "CruiseProduct" USING GIN ("shipName" gin_trgm_ops);

-- packageName ILIKE 검색 (keyword 검색)
CREATE INDEX IF NOT EXISTS "idx_cruise_product_packagename_trgm"
  ON "CruiseProduct" USING GIN ("packageName" gin_trgm_ops);

-- ============================================
-- B0-C6: ScheduledMessageLog.channel 컬럼 추가
-- metadata 파싱 → 직접 컬럼 groupBy로 교체 (findMany 1000행 → groupBy 1행)
-- ============================================
ALTER TABLE "ScheduledMessageLog"
  ADD COLUMN IF NOT EXISTS "channel" VARCHAR(20);

-- 기존 데이터 backfill: metadata->'channel' 값으로 채우기 (Idempotent)
UPDATE "ScheduledMessageLog"
SET "channel" = LOWER((metadata->>'channel')::TEXT)
WHERE "channel" IS NULL
  AND metadata IS NOT NULL
  AND metadata->>'channel' IS NOT NULL;

-- channel + status 복합 인덱스 (groupBy 쿼리 최적화)
CREATE INDEX IF NOT EXISTS "idx_scheduled_message_log_channel_status"
  ON "ScheduledMessageLog" ("channel", "status");
