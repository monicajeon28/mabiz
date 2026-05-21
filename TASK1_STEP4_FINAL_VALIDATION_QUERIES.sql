-- ========================================
-- TASK 1 Step 4: 최종 검증 쿼리 3단계
-- ========================================
-- 목적: Contact userId 정정 작업의 Step 5 검증 준비
-- 작성: Agent γ (2026-05-21)
-- 상태: 프로덕션 DB 실행 준비 완료
-- ========================================

-- ========================================
-- 단계 1: 데이터 정정 "전" 상태 (베이스라인)
-- 목적: 정정 전 현황을 기록으로 남겨 정정 효과 검증
-- 실행 시기: SCRIPT 1, 2, 3 실행 "이전"
-- ========================================

-- 1-1. 고아 Contact 개수 (정정 전)
-- 정의: userId가 있지만 GoldMember가 없는 Contact
-- 예상: SCRIPT 1 실행 후 이 개수만큼 userId가 NULL로 변경됨
SELECT COUNT(*) as orphaned_contacts_before
FROM "Contact" c
WHERE c."userId" IS NOT NULL
  AND c."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "GoldMember" gm WHERE gm."userId" = c."userId"
  );

-- 1-2. 중복 Contact 개수 (정정 전)
-- 정의: 같은 phone + organizationId로 여러 Contact 존재
-- 예상: SCRIPT 2 실행 후 이 개수만큼 Contact가 soft delete됨
SELECT COUNT(*) as duplicate_groups_before
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(*) > 1
) t;

-- 1-3. 중복 Contact에 영향받는 CallLog 개수 (정정 전)
-- 정의: SCRIPT 2 실행 시 재지정 대상이 될 CallLog
-- 예상: 이 개수가 정정 후에도 동일 유지되어야 함
SELECT COUNT(*) as calllog_affected_before
FROM "CallLog" cl
WHERE EXISTS (
  SELECT 1 FROM "Contact" c
  WHERE c.id = cl."contactId"
    AND c."deletedAt" IS NULL
    AND EXISTS (
      SELECT 1 FROM (
        SELECT phone, "organizationId"
        FROM "Contact"
        WHERE "deletedAt" IS NULL
        GROUP BY phone, "organizationId"
        HAVING COUNT(*) > 1
      ) t
      WHERE t.phone = c.phone
        AND t."organizationId" = c."organizationId"
    )
);

-- 1-4. 다중 userId Contact 개수 (정정 전)
-- 정의: 같은 phone이지만 다른 userId를 가진 Contact 그룹
-- 예상: SCRIPT 3 실행 후 이 개수는 0이 되어야 함
SELECT COUNT(*) as inconsistent_userid_groups_before
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(DISTINCT "userId") > 1
) t;

-- 1-5. 전체 활성 Contact 통계 (정정 전)
-- 목적: 전체 구조 파악
SELECT
  COUNT(*) as total_active_before,
  COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as with_userId_before,
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as without_userId_before,
  COUNT(DISTINCT phone) as unique_phones_before,
  ROUND(100.0 * COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) / COUNT(*), 2) as userId_rate_before
FROM "Contact"
WHERE "deletedAt" IS NULL;

---

-- ========================================
-- 단계 2: SCRIPT 1/2/3 순차 실행 후 상태
-- 목적: 각 SCRIPT 실행 후 영향도 확인
-- 실행 순서: 분석쿼리 → SCRIPT 1 → 분석쿼리 → SCRIPT 2 → 분석쿼리 → SCRIPT 3
-- ========================================

-- 2-1. SCRIPT 1 실행 후 확인
-- 확인사항: orphaned_contacts_before - 이 값만큼 userId가 NULL로 변경되어야 함
SELECT
  COUNT(*) as total_contacts_after_script1,
  COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as with_userId_after_script1,
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as without_userId_after_script1
FROM "Contact"
WHERE "deletedAt" IS NULL;

-- 2-2. SCRIPT 2 실행 후 확인
-- 확인사항:
--   - total_contacts가 duplicate_groups_before 개만큼 감소
--   - 남은 Contact들은 soft delete되지 않음
SELECT
  COUNT(*) as total_active_after_script2,
  COUNT(CASE WHEN "deletedAt" IS NOT NULL THEN 1 END) as soft_deleted_total,
  COUNT(CASE WHEN "deletedAt" = CURRENT_DATE THEN 1 END) as soft_deleted_today
FROM "Contact";

-- 2-3. SCRIPT 2 실행 후 CallLog FK 검증
-- 확인사항: CallLog의 모든 contactId가 유효한 Contact를 참조해야 함
SELECT COUNT(*) as orphaned_calllog_after_script2
FROM "CallLog" cl
WHERE NOT EXISTS (
  SELECT 1 FROM "Contact" c
  WHERE c.id = cl."contactId" AND c."deletedAt" IS NULL
);

-- 2-4. SCRIPT 3 실행 후 userId 일관성 재확인
-- 확인사항: 다중 userId 그룹이 0이 되어야 함
SELECT COUNT(*) as inconsistent_groups_after_script3
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(DISTINCT "userId") > 1
) t;

---

-- ========================================
-- 단계 3: FK 무결성 최종 검증 (정정 후)
-- 목적: 모든 정정이 완료된 후 데이터 무결성 확보 확인
-- 실행 시기: SCRIPT 1, 2, 3 모두 완료 후
-- 성공 조건: 모든 COUNT 결과가 0이어야 함
-- ========================================

-- 3-1. Contact FK 검증: userId 무결성
-- 모든 Contact.userId가 GoldMember에 존재해야 함
SELECT COUNT(*) as orphaned_contacts_final
FROM "Contact" c
WHERE c."userId" IS NOT NULL
  AND c."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "GoldMember" gm WHERE gm."userId" = c."userId"
  );
-- 예상: 0 (필수)

-- 3-2. Contact 중복 검증: phone+org 유일성
-- 활성 Contact에서 phone+org 조합이 유일해야 함
SELECT COUNT(*) as duplicate_phones_final
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(*) > 1
) t;
-- 예상: 0 (필수)

-- 3-3. userId 일관성 검증: phone당 1개 userId만
-- 같은 phone의 모든 Contact가 동일한 userId를 가져야 함
SELECT COUNT(*) as inconsistent_userids_final
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(DISTINCT "userId") > 1
) t;
-- 예상: 0 (필수)

-- 3-4. CallLog FK 검증: contactId 무결성
-- 모든 CallLog.contactId가 유효한 Contact를 참조해야 함
SELECT COUNT(*) as orphaned_calllogs_final
FROM "CallLog" cl
WHERE NOT EXISTS (
  SELECT 1 FROM "Contact" c
  WHERE c.id = cl."contactId" AND c."deletedAt" IS NULL
);
-- 예상: 0 (필수)

-- 3-5. ContactGroupMember FK 검증 (선택사항)
-- 모든 ContactGroupMember.contactId가 유효해야 함
SELECT COUNT(*) as orphaned_group_members_final
FROM "ContactGroupMember" cgm
WHERE NOT EXISTS (
  SELECT 1 FROM "Contact" c
  WHERE c.id = cgm."contactId" AND c."deletedAt" IS NULL
);
-- 예상: 0 (필수)

-- 3-6. 최종 상태 통계
SELECT
  COUNT(*) as total_active_final,
  COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as with_userId_final,
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as without_userId_final,
  COUNT(DISTINCT phone) as unique_phones_final,
  ROUND(100.0 * COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) / COUNT(*), 2) as userId_rate_final,
  MAX("updatedAt") as latest_update
FROM "Contact"
WHERE "deletedAt" IS NULL;

-- 3-7. 정정 과정 영향도 요약
-- BEFORE → AFTER 비교
WITH stats_before AS (
  SELECT
    'BEFORE' as phase,
    COUNT(*) as total,
    COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as with_user
  FROM "Contact"
  WHERE "deletedAt" IS NULL
),
stats_after AS (
  SELECT
    'AFTER' as phase,
    COUNT(*) as total,
    COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as with_user
  FROM "Contact"
  WHERE "deletedAt" IS NULL
)
SELECT
  phase,
  total,
  with_user,
  ROUND(100.0 * with_user / total, 2) as userId_rate
FROM (
  SELECT * FROM stats_before
  UNION ALL
  SELECT * FROM stats_after
) t
ORDER BY phase;

---

-- ========================================
-- 추가: 성능 확인 쿼리
-- 목적: SCRIPT 실행 후 인덱스 상태 확인
-- ========================================

-- A-1. Contact 테이블 인덱스 상태
SELECT
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE relname = 'Contact'
ORDER BY idx_scan DESC;

-- A-2. CallLog 테이블 인덱스 상태
SELECT
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE relname = 'CallLog'
ORDER BY idx_scan DESC;

-- A-3. 테이블 사이즈 확인
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size
FROM pg_tables
WHERE tablename IN ('Contact', 'CallLog', 'GoldMember', 'ContactGroupMember')
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

---

-- ========================================
-- 디버깅: 문제 발생 시 조사 쿼리
-- ========================================

-- D-1. Contact 상태별 분포
SELECT
  CASE
    WHEN "deletedAt" IS NOT NULL THEN 'soft_deleted'
    WHEN "userId" IS NULL THEN 'no_user'
    WHEN EXISTS (SELECT 1 FROM "GoldMember" WHERE "userId" = c."userId") THEN 'gold_member'
    ELSE 'orphaned'
  END as status,
  COUNT(*) as count
FROM "Contact" c
GROUP BY status
ORDER BY count DESC;

-- D-2. 최근 7일간 변경 이력
SELECT
  DATE("updatedAt") as update_date,
  COUNT(*) as contact_count,
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as null_userId_count
FROM "Contact"
WHERE "updatedAt" >= NOW() - INTERVAL '7 days'
GROUP BY DATE("updatedAt")
ORDER BY update_date DESC;

-- D-3. 특정 phone의 Contact 그룹 조사
-- (예: 가장 많은 중복 phone 찾기)
SELECT
  phone,
  "organizationId",
  COUNT(*) as contact_count,
  COUNT(DISTINCT "userId") as distinct_userid_count,
  STRING_AGG(DISTINCT "userId"::text, ', ') as userIds,
  STRING_AGG("id"::text, ', ') as contactIds
FROM "Contact"
WHERE "deletedAt" IS NULL
GROUP BY phone, "organizationId"
HAVING COUNT(*) > 1
ORDER BY contact_count DESC
LIMIT 10;

-- ========================================
-- 끝
-- ========================================
