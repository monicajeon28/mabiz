-- Track A: 이의처리 메타데이터 필드 추가
-- objectionId: 감지된 이의 ID (A-001 ~ F-004 형식)
-- customerReaction: 고객 반응 ("positive" | "neutral" | "negative")
-- recovered: 이의가 성공적으로 해결되었는가
-- recoveryTime: 이의 해결에 소요된 시간 (초)

ALTER TABLE "CallLog"
ADD COLUMN "objectionId" TEXT;

ALTER TABLE "CallLog"
ADD COLUMN "customerReaction" TEXT;

ALTER TABLE "CallLog"
ADD COLUMN "recovered" BOOLEAN;

ALTER TABLE "CallLog"
ADD COLUMN "recoveryTime" INTEGER;

-- 이의별 처리 성공률 집계용 인덱스
CREATE INDEX IF NOT EXISTS "idx_calllog_objection_recovered"
ON "CallLog"("objectionId", "recovered")
WHERE "recovered" IS NOT NULL;

-- 고객 반응별 집계용 인덱스
CREATE INDEX IF NOT EXISTS "idx_calllog_reaction"
ON "CallLog"("customerReaction")
WHERE "customerReaction" IS NOT NULL;
