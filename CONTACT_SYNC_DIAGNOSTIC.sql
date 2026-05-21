-- ============================================================================
-- CRM Contact 동기화 진단 쿼리 (2026-05-21)
-- ============================================================================
-- 주의: 프로덕션 환경에서는 읽기 전용 쿼리만 실행하세요.

-- ============================================================================
-- 1. 현황 분석
-- ============================================================================

-- 1.1 전체 Contact 통계
SELECT
  COUNT(*) as total_contacts,
  COUNT(DISTINCT CASE WHEN userId IS NOT NULL THEN userId END) as contacts_with_userid,
  COUNT(DISTINCT CASE WHEN userId IS NULL THEN 1 END) as contacts_without_userid,
  COUNT(DISTINCT CASE WHEN segment IS NOT NULL THEN 1 END) as contacts_with_segment,
  COUNT(DISTINCT CASE WHEN deletedAt IS NOT NULL THEN 1 END) as soft_deleted,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN userId IS NOT NULL THEN 1 END) / COUNT(*), 2) as pct_with_userid
FROM Contact;

-- 1.2 조직별 Contact 분포
SELECT
  o.name as organization,
  COUNT(c.id) as total_contacts,
  COUNT(DISTINCT CASE WHEN c.type = 'LEAD' THEN c.id END) as leads,
  COUNT(DISTINCT CASE WHEN c.type = 'CUSTOMER' THEN c.id END) as customers,
  COUNT(DISTINCT CASE WHEN c.type = 'PURCHASED' THEN c.id END) as purchased,
  COUNT(DISTINCT CASE WHEN c.userId IS NOT NULL THEN c.userId END) as with_userid,
  COUNT(DISTINCT CASE WHEN c.segment IS NOT NULL THEN 1 END) as with_segment,
  COUNT(DISTINCT CASE WHEN c.deletedAt IS NOT NULL THEN 1 END) as soft_deleted
FROM Contact c
JOIN Organization o ON c.organizationId = o.id
WHERE c.deletedAt IS NULL
GROUP BY o.id, o.name
ORDER BY COUNT(c.id) DESC;

-- 1.3 Contact 채널별 분포
SELECT
  channel,
  type,
  COUNT(*) as count,
  COUNT(DISTINCT CASE WHEN userId IS NOT NULL THEN 1 END) as with_userid,
  COUNT(DISTINCT CASE WHEN segment IS NOT NULL THEN 1 END) as with_segment,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN userId IS NOT NULL THEN 1 END) / COUNT(*), 2) as pct_linked
FROM Contact
WHERE deletedAt IS NULL
GROUP BY channel, type
ORDER BY count DESC;

-- 1.4 Contact.segment 분포 (세그먼트 A-E)
SELECT
  CASE
    WHEN segment IS NULL THEN '[NULL]'
    ELSE segment
  END as segment,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage,
  COUNT(DISTINCT organizationId) as num_orgs,
  COUNT(DISTINCT CASE WHEN userId IS NOT NULL THEN userId END) as with_userid
FROM Contact
WHERE deletedAt IS NULL
GROUP BY segment
ORDER BY count DESC;

-- 1.5 Contact 생성 시간대별 분포
SELECT
  DATE_TRUNC('day', c.createdAt)::date as date,
  COUNT(*) as created,
  COUNT(DISTINCT CASE WHEN c.userId IS NOT NULL THEN 1 END) as with_userid,
  COUNT(DISTINCT CASE WHEN c.segment IS NOT NULL THEN 1 END) as with_segment
FROM Contact c
WHERE c.deletedAt IS NULL
GROUP BY DATE_TRUNC('day', c.createdAt)
ORDER BY date DESC
LIMIT 30;

-- ============================================================================
-- 2. 🔴 P0 이슈 진단
-- ============================================================================

-- 2.1 고아 Contact (userId가 있지만 GmUser 없음)
SELECT
  c.id,
  c.phone,
  c.name,
  c.userId,
  c.organizationId,
  c.type,
  c.createdAt,
  c.updatedAt,
  'ORPHAN' as issue
FROM Contact c
LEFT JOIN "User" u ON c.userId = u.id
WHERE c.userId IS NOT NULL
  AND u.id IS NULL
  AND c.deletedAt IS NULL
LIMIT 100;

-- 고아 Contact 요약
SELECT
  COUNT(*) as orphan_count,
  COUNT(DISTINCT organizationId) as affected_orgs,
  COUNT(DISTINCT CASE WHEN updatedAt > NOW() - INTERVAL '7 days' THEN 1 END) as recent_orphans
FROM Contact c
LEFT JOIN "User" u ON c.userId = u.id
WHERE c.userId IS NOT NULL
  AND u.id IS NULL
  AND c.deletedAt IS NULL;

-- 2.2 Contact.segment 미설정 (웹훅 경로 추정)
SELECT
  c.channel,
  c.type,
  COUNT(*) as total,
  COUNT(DISTINCT CASE WHEN c.segment IS NULL THEN 1 END) as without_segment,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN c.segment IS NULL THEN 1 END) / COUNT(*), 2) as pct_no_segment,
  COUNT(DISTINCT CASE WHEN c.purchasedAt IS NOT NULL THEN 1 END) as purchased,
  COUNT(DISTINCT CASE WHEN c.createdAt > NOW() - INTERVAL '7 days' THEN 1 END) as recent
FROM Contact c
WHERE c.deletedAt IS NULL
  AND c.segment IS NULL
GROUP BY c.channel, c.type
ORDER BY total DESC;

-- 2.3 ContactLensClassification 미생성 Contact
SELECT
  c.id,
  c.phone,
  c.name,
  c.segment,
  c.type,
  c.createdAt,
  COUNT(clc.id) as lens_classifications,
  COUNT(cls.id) as lens_sequences,
  'NO_LENS_CLASSIFICATION' as issue
FROM Contact c
LEFT JOIN ContactLensClassification clc ON clc.contactId = c.id
LEFT JOIN ContactLensSequence cls ON cls.contactId = c.id
WHERE c.deletedAt IS NULL
  AND c.type IN ('CUSTOMER', 'PURCHASED')
  AND clc.id IS NULL
GROUP BY c.id, c.phone, c.name, c.segment, c.type, c.createdAt
HAVING COUNT(clc.id) = 0
LIMIT 50;

-- 요약: 렌즈 미분류 Contact
SELECT
  COUNT(*) as total_without_lens,
  COUNT(DISTINCT organizationId) as affected_orgs,
  COUNT(DISTINCT CASE WHEN type IN ('CUSTOMER', 'PURCHASED') THEN 1 END) as paying_customers,
  COUNT(DISTINCT CASE WHEN purchasedAt IS NOT NULL THEN 1 END) as with_purchase_history
FROM Contact c
LEFT JOIN ContactLensClassification clc ON clc.contactId = c.id AND clc.status = 'ACTIVE'
WHERE c.deletedAt IS NULL
  AND clc.id IS NULL;

-- 2.4 Contact에 설정되지 않은 필드 (GmUser에서 누락)
-- 이 쿼리는 매핑 문제를 보여줌
SELECT
  COUNT(DISTINCT c.id) as contacts_with_linked_user,
  COUNT(DISTINCT CASE WHEN u.customerStatus IS NOT NULL THEN c.id END) as missing_customerstatus,
  COUNT(DISTINCT CASE WHEN u.isHibernated = true THEN c.id END) as missing_hibernation,
  COUNT(DISTINCT CASE WHEN u.isLocked = true THEN c.id END) as missing_locked_status,
  COUNT(DISTINCT CASE WHEN u.memberStatus IS NOT NULL THEN c.id END) as missing_member_status
FROM Contact c
JOIN "User" u ON c.userId = u.id
WHERE c.deletedAt IS NULL;

-- ============================================================================
-- 3. 🟠 P1 이슈 진단
-- ============================================================================

-- 3.1 Contact.lastPaymentAt 미설정 (purchasedAt만 사용)
SELECT
  COUNT(*) as with_purchase,
  COUNT(DISTINCT CASE WHEN c.purchasedAt IS NOT NULL AND c.lastPaymentAt IS NULL THEN c.id END) as missing_last_payment,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN c.purchasedAt IS NOT NULL AND c.lastPaymentAt IS NULL THEN 1 END) / COUNT(*), 2) as pct_missing
FROM Contact c
WHERE c.type IN ('CUSTOMER', 'PURCHASED')
  AND c.purchasedAt IS NOT NULL
  AND c.deletedAt IS NULL;

-- 3.2 N+1 쿼리 가능성 (userId 배치 로드 부족)
-- Contact 목록 조회 후 각 userId로 GmUser 조회 필요 시
SELECT
  COUNT(DISTINCT c.userId) as unique_userids,
  COUNT(*) as total_contacts,
  COUNT(DISTINCT c.organizationId) as orgs_affected
FROM Contact c
WHERE c.userId IS NOT NULL
  AND c.deletedAt IS NULL;

-- 3.3 Contact.assignedUserId 미설정 (구매 고객)
SELECT
  COUNT(*) as purchased_total,
  COUNT(DISTINCT CASE WHEN assignedUserId IS NULL THEN c.id END) as unassigned,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN assignedUserId IS NULL THEN 1 END) / COUNT(*), 2) as pct_unassigned,
  MAX(purchasedAt) as latest_purchase
FROM Contact c
WHERE c.type IN ('CUSTOMER', 'PURCHASED')
  AND c.purchasedAt IS NOT NULL
  AND c.deletedAt IS NULL;

-- 3.4 Contact 최근 업데이트 현황 (동기화 활동)
SELECT
  DATE_TRUNC('day', c.updatedAt)::date as date,
  COUNT(*) as updates,
  COUNT(DISTINCT CASE WHEN userId IS NOT NULL THEN 1 END) as linked_updates,
  COUNT(DISTINCT CASE WHEN segment IS NOT NULL THEN 1 END) as segment_updates
FROM Contact c
WHERE c.deletedAt IS NULL
GROUP BY DATE_TRUNC('day', c.updatedAt)
ORDER BY date DESC
LIMIT 30;

-- ============================================================================
-- 4. 🟡 P2 이슈 진단
-- ============================================================================

-- 4.1 중복 Contact (같은 phone, 다른 org)
SELECT
  phone,
  COUNT(DISTINCT organizationId) as num_orgs,
  COUNT(*) as total,
  STRING_AGG(DISTINCT organizationId::text, ', ') as org_ids
FROM Contact
WHERE deletedAt IS NULL
GROUP BY phone
HAVING COUNT(DISTINCT organizationId) > 1
ORDER BY total DESC
LIMIT 50;

-- 4.1b 중복 Contact 요약
SELECT
  COUNT(DISTINCT phone) as duplicate_phones,
  SUM(total) as total_duplicate_contacts
FROM (
  SELECT
    phone,
    COUNT(DISTINCT organizationId) as num_orgs,
    COUNT(*) as total
  FROM Contact
  WHERE deletedAt IS NULL
  GROUP BY phone
  HAVING COUNT(DISTINCT organizationId) > 1
) t;

-- 4.2 Contact.segment override 사용량
SELECT
  COUNT(*) as total_with_override,
  COUNT(DISTINCT CASE WHEN segment <> segmentOverride THEN 1 END) as mismatches,
  COUNT(DISTINCT organizationId) as orgs_using
FROM Contact
WHERE segmentOverride IS NOT NULL
  AND deletedAt IS NULL;

-- 4.3 채널별 Contact 분포 (자동 감지 평가)
SELECT
  channel,
  COUNT(*) as total,
  COUNT(DISTINCT CASE WHEN type = 'LEAD' THEN 1 END) as leads,
  COUNT(DISTINCT CASE WHEN type IN ('CUSTOMER', 'PURCHASED') THEN 1 END) as purchases,
  ROUND(AVG(CAST(leadScore AS FLOAT)), 1) as avg_leadscore
FROM Contact
WHERE deletedAt IS NULL
GROUP BY channel
ORDER BY total DESC;

-- 4.4 Contact soft-delete 분포 (데이터 정제도)
SELECT
  COUNT(DISTINCT CASE WHEN deletedAt IS NULL THEN 1 END) as active,
  COUNT(DISTINCT CASE WHEN deletedAt IS NOT NULL THEN 1 END) as soft_deleted,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN deletedAt IS NOT NULL THEN 1 END) / COUNT(*), 2) as pct_deleted,
  MAX(deletedAt) as latest_deletion
FROM Contact;

-- ============================================================================
-- 5. 렌즈 분류 현황 (L0-L10)
-- ============================================================================

-- 5.1 ContactLensClassification 분포
SELECT
  clc.lensType,
  COUNT(*) as count,
  COUNT(DISTINCT clc.contactId) as unique_contacts,
  COUNT(DISTINCT clc.organizationId) as num_orgs,
  ROUND(AVG(clc.confidenceScore), 2) as avg_confidence,
  COUNT(DISTINCT CASE WHEN clc.status = 'ACTIVE' THEN 1 END) as active_count,
  COUNT(DISTINCT CASE WHEN clc.convertedAt IS NOT NULL THEN 1 END) as converted_count
FROM ContactLensClassification clc
GROUP BY clc.lensType
ORDER BY count DESC;

-- 5.2 ContactLensSequence 진행률 (Day 0-3)
SELECT
  clc.lensType,
  cls.status,
  COUNT(*) as count,
  COUNT(DISTINCT CASE WHEN cls.day0Sent THEN 1 END) as day0_sent,
  COUNT(DISTINCT CASE WHEN cls.day0Clicked THEN 1 END) as day0_clicked,
  COUNT(DISTINCT CASE WHEN cls.overallConverted THEN 1 END) as converted
FROM ContactLensSequence cls
JOIN ContactLensClassification clc ON cls.classificationId = clc.id
GROUP BY clc.lensType, cls.status
ORDER BY clc.lensType, cls.status;

-- 5.3 렌즈별 변환 추적
SELECT
  clc.lensType,
  COUNT(*) as total_sequences,
  COUNT(DISTINCT CASE WHEN cls.overallConverted THEN 1 END) as converted,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN cls.overallConverted THEN 1 END) / COUNT(*), 2) as conversion_rate,
  ROUND(AVG(CAST(COALESCE(cls.conversionRevenue, 0) AS FLOAT)), 2) as avg_revenue
FROM ContactLensSequence cls
JOIN ContactLensClassification clc ON cls.classificationId = clc.id
WHERE cls.status IN ('COMPLETED', 'PENDING')
GROUP BY clc.lensType
ORDER BY conversion_rate DESC;

-- ============================================================================
-- 6. 웹훅 처리 현황 (이벤트 기반 동기화 평가)
-- ============================================================================

-- 6.1 ProcessedWebhookEvent 통계
SELECT
  webhookType,
  COUNT(*) as total_processed,
  COUNT(DISTINCT DATE(createdAt)) as days_active,
  MAX(createdAt) as latest_event,
  MIN(createdAt) as first_event
FROM ProcessedWebhookEvent
GROUP BY webhookType
ORDER BY total_processed DESC;

-- 6.2 최근 웹훅 이벤트 (최근 7일)
SELECT
  webhookType,
  COUNT(*) as count,
  MAX(createdAt) as latest
FROM ProcessedWebhookEvent
WHERE createdAt > NOW() - INTERVAL '7 days'
GROUP BY webhookType
ORDER BY count DESC;

-- 6.3 실패한 웹훅 (DLQ에 대기 중)
-- 참고: DLQ 테이블이 있다면
-- SELECT COUNT(*) as pending_dlq FROM mabiz_dlq WHERE status = 'PENDING';

-- ============================================================================
-- 7. 권장 정정 쿼리 (백업 후 실행)
-- ============================================================================

-- 7.1 고아 Contact userId 무효화 (P0-2 대응)
-- ⚠️ 백업 후 실행
-- UPDATE Contact SET userId = NULL
-- WHERE userId IS NOT NULL
--   AND userId NOT IN (SELECT id FROM "User")
--   AND updatedAt > NOW() - INTERVAL '7 days';

-- 7.2 Contact.segment 재계산 (필드 보충 필요)
-- ⚠️ 이 쿼리는 age/maritalStatus/childrenCount 필드가 필요하므로
--    현재는 SELECT 만 가능 (데이터 부족)
-- SELECT
--   id, age, maritalStatus, childrenCount, segment,
--   CASE
--     WHEN age >= 25 AND age <= 35 AND maritalStatus = 'MARRIED' AND childrenCount = 0 THEN 'A'
--     WHEN age >= 40 AND age <= 50 AND childrenCount > 0 THEN 'B'
--     WHEN age >= 45 AND age <= 55 AND maritalStatus = 'MARRIED' AND childrenCount = 0 THEN 'C'
--     WHEN age >= 50 AND age <= 65 THEN 'D'
--     WHEN age > 65 THEN 'E'
--     ELSE segment
--   END as calculated_segment
-- FROM Contact
-- WHERE segmentOverride IS NULL
--   AND age IS NOT NULL;

-- ============================================================================
-- 8. 성능 체크 (인덱스 활용도)
-- ============================================================================

-- 8.1 Contact 테이블 인덱스 현황 (PostgreSQL)
-- 참고: 다른 DB는 구문이 다를 수 있음
-- SELECT
--   indexname,
--   idx_scan as scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE relname = 'Contact'
-- ORDER BY idx_scan DESC;

-- 8.2 추가 필요 인덱스 확인
-- idx_contact_userId (userId 배치 로드용)
-- idx_contact_segment_org (segment 필터링용)
-- idx_contact_channel_type_created (웹훅 경로 분석용)

-- ============================================================================
-- 분석 완료 (2026-05-21)
-- ============================================================================
