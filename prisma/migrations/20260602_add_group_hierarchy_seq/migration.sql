-- Migration: 20260602_add_group_hierarchy_seq
-- Description: ContactGroup 계층 구조, seq, 재유입 정책, 자동이동, 복수 퍼널 연결 추가

-- 1. seq 컬럼 추가 (임베드 스크립트용 16자 고유 ID, NULL = 미생성)
ALTER TABLE "ContactGroup" ADD COLUMN IF NOT EXISTS "seq" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ContactGroup_seq_key" ON "ContactGroup"("seq") WHERE "seq" IS NOT NULL;

-- 2. parentGroupId 컬럼 추가 (대그룹 self-relation)
ALTER TABLE "ContactGroup" ADD COLUMN IF NOT EXISTS "parentGroupId" TEXT;

-- 3. category 컬럼 추가 (대분류)
ALTER TABLE "ContactGroup" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- 4. reEntryPolicy 컬럼 추가 (재유입 처리 정책)
ALTER TABLE "ContactGroup" ADD COLUMN IF NOT EXISTS "reEntryPolicy" TEXT NOT NULL DEFAULT 'KEEP_TIME_KEEP_DATA';

-- 5. autoMoveEnabled 컬럼 추가 (그룹 자동이동 활성화)
ALTER TABLE "ContactGroup" ADD COLUMN IF NOT EXISTS "autoMoveEnabled" BOOLEAN NOT NULL DEFAULT false;

-- 6. autoMoveDays 컬럼 추가 (자동이동 대상 일자)
ALTER TABLE "ContactGroup" ADD COLUMN IF NOT EXISTS "autoMoveDays" INTEGER;

-- 7. autoMoveTargetGroupId 컬럼 추가 (자동이동 대상 그룹)
ALTER TABLE "ContactGroup" ADD COLUMN IF NOT EXISTS "autoMoveTargetGroupId" TEXT;

-- 8. funnelIds 배열 컬럼 추가 (복수 퍼널톡 연결)
ALTER TABLE "ContactGroup" ADD COLUMN IF NOT EXISTS "funnelIds" TEXT[] NOT NULL DEFAULT '{}';

-- 9. funnelSmsIds 배열 컬럼 추가 (복수 퍼널문자 연결)
ALTER TABLE "ContactGroup" ADD COLUMN IF NOT EXISTS "funnelSmsIds" TEXT[] NOT NULL DEFAULT '{}';

-- 10. funnelEmailIds 배열 컬럼 추가 (복수 퍼널메일 연결)
ALTER TABLE "ContactGroup" ADD COLUMN IF NOT EXISTS "funnelEmailIds" TEXT[] NOT NULL DEFAULT '{}';

-- 11. self-relation FK 추가 (계층 구조)
ALTER TABLE "ContactGroup" ADD CONSTRAINT "ContactGroup_parentGroupId_fkey"
  FOREIGN KEY ("parentGroupId") REFERENCES "ContactGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 12. seq 인덱스
CREATE INDEX IF NOT EXISTS "ContactGroup_seq_idx"
  ON "ContactGroup"("seq");

-- 13. parentGroupId 인덱스
CREATE INDEX IF NOT EXISTS "ContactGroup_parentGroupId_idx"
  ON "ContactGroup"("parentGroupId");

-- 14. 커버링 인덱스 (트리 뷰 쿼리 최적화)
CREATE INDEX IF NOT EXISTS "ContactGroup_organizationId_parentGroupId_seq_idx"
  ON "ContactGroup"("organizationId", "parentGroupId", "seq");
