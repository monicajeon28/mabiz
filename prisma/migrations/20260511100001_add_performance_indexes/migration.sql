-- ============================================================
-- Phase 1-3: 성능 인덱스 5건 + FK 2건 추가
-- ============================================================
-- ⚠️  주의사항:
--   1. 이 파일은 참조/수동 실행 전용입니다.
--   2. `prisma migrate deploy` 로 절대 실행하지 마세요.
--   3. 프로덕션 DB(Neon PostgreSQL)에서 직접 SQL로 실행하세요.
--   4. CREATE INDEX CONCURRENTLY는 트랜잭션 안에서 실행 불가 →
--      BEGIN/COMMIT으로 감싸지 마세요.
--   5. _prisma_migrations 테이블에 수동 기록하지 않습니다.
-- ============================================================

-- ---------------------------------------------------------
-- 1. VipCareSequence: contactId + funnelId + status 복합 인덱스
--    funnel-trigger.ts에서 { contactId, funnelId, status: "ACTIVE" } 조회 최적화
-- ---------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vipcare_contact_funnel_status
  ON "VipCareSequence"("contactId", "funnelId", "status");

-- ---------------------------------------------------------
-- 2. CrmLandingRegistration: phone 단독 인덱스
--    stats/route.ts에서 phone IN (...) 조회 최적화
-- ---------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_landing_reg_phone
  ON "CrmLandingRegistration"("phone");

-- ---------------------------------------------------------
-- 3. VipCareLog: sequenceId + status + scheduledAt 복합 인덱스
--    cron/vip-care에서 3조건 쿼리 최적화
-- ---------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vipcarelog_seq_status_scheduled
  ON "VipCareLog"("sequenceId", "status", "scheduledAt");

-- ---------------------------------------------------------
-- 4. SmsLog (실제 테이블: CrmSmsLog): sentAt 단독 인덱스
--    90일 이전 삭제 쿼리 최적화
--    ※ Prisma 모델명 SmsLog → @@map("CrmSmsLog")
-- ---------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_smslog_sentat
  ON "CrmSmsLog"("sentAt");

-- ---------------------------------------------------------
-- 5. ContactFunnelState: organizationId + status + nextScheduledAt 복합 인덱스
--    Cron에서 조직별 + 상태별 + 스케줄 기반 조회 최적화
-- ---------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funnel_state_org_status_scheduled
  ON "ContactFunnelState"("organizationId", "status", "nextScheduledAt");

-- =========================================================
-- FK 추가 (CrmLandingPage → ContactGroup, Funnel)
-- =========================================================

-- ---------------------------------------------------------
-- 6. CrmLandingPage.groupId → ContactGroup.id
-- ---------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_landing_page_group'
  ) THEN
    ALTER TABLE "CrmLandingPage"
      ADD CONSTRAINT fk_landing_page_group
      FOREIGN KEY ("groupId") REFERENCES "ContactGroup"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------
-- 7. CrmLandingPage.autoFunnelId → Funnel.id
-- ---------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_landing_page_auto_funnel'
  ) THEN
    ALTER TABLE "CrmLandingPage"
      ADD CONSTRAINT fk_landing_page_auto_funnel
      FOREIGN KEY ("autoFunnelId") REFERENCES "Funnel"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
