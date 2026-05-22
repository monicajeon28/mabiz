-- A/B Test Analysis Queries
-- Phase 3 Track D: Statistical validation
-- Author: CRM Analytics Team
-- Date: 2026-05-22

-- ============================================================================
-- Query 1: A/B 전환율 비교 (최종 지표)
-- ============================================================================
-- 목적: A와 B 그룹의 전환율, 통화시간, 고객 수를 비교
-- 사용: 주간 리포트, 최종 분석, 의사결정
-- 출력: 각 그룹별 전환율 및 통계

SELECT
  COALESCE(abTestGroup, 'UNASSIGNED') as test_group,
  COUNT(*) as total_calls,
  COUNT(DISTINCT contactId) as unique_contacts,
  SUM(CASE WHEN conversionDay IS NOT NULL THEN 1 ELSE 0 END) as conversions,
  ROUND(100.0 * SUM(CASE WHEN conversionDay IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as conversion_rate,
  ROUND(AVG(callDurationMs) / 1000.0, 1) as avg_duration_sec,
  ROUND(STDDEV(callDurationMs) / 1000.0, 1) as stddev_duration_sec,
  MIN(callStartedAt) as first_call,
  MAX(callStartedAt) as last_call,
  DATEDIFF(day, MIN(callStartedAt), MAX(callStartedAt)) as test_days
FROM "CallLog"
WHERE
  callStartedAt >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY abTestGroup
ORDER BY
  CASE
    WHEN abTestGroup = 'A' THEN 1
    WHEN abTestGroup = 'B' THEN 2
    ELSE 3
  END;

-- ============================================================================
-- Query 2: 이탈 분석 (콜 품질)
-- ============================================================================
-- 목적: A와 B 그룹에서 어느 단계에서 고객이 가장 많이 끊는지 분석
-- 사용: 스크립트 개선 지점 식별, 문제 단계 파악
-- 출력: 각 그룹별 단계별 이탈 수 및 비율

SELECT
  COALESCE(abTestGroup, 'UNASSIGNED') as test_group,
  COALESCE(abandonmentPhase, 'COMPLETED') as abandonment_phase,
  COUNT(*) as call_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY abTestGroup), 2) as percentage_of_group,
  ROUND(AVG(callDurationMs) / 1000.0, 1) as avg_duration_before_abandon_sec
FROM "CallLog"
WHERE
  abTestGroup IS NOT NULL
  AND callStartedAt >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY abTestGroup, abandonmentPhase
ORDER BY
  CASE
    WHEN abTestGroup = 'A' THEN 1
    WHEN abTestGroup = 'B' THEN 2
    ELSE 3
  END,
  call_count DESC;

-- ============================================================================
-- Query 3: 세그먼트별 전환율 비교
-- ============================================================================
-- 목적: 고객 세그먼트(나이, 성별, 채널 등)별로 A/B 효과가 다른지 분석
-- 사용: 타겟 세그먼트 최적화, 페르소나별 전략 수정
-- 출력: 세그먼트별 A/B 전환율 비교

SELECT
  cl.abTestGroup,
  COALESCE(c.segment, 'UNKNOWN') as customer_segment,
  COUNT(*) as calls,
  SUM(CASE WHEN cl.conversionDay IS NOT NULL THEN 1 ELSE 0 END) as conversions,
  ROUND(100.0 * SUM(CASE WHEN cl.conversionDay IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as conversion_rate,
  COUNT(DISTINCT cl.contactId) as unique_contacts,
  ROUND(AVG(cl.callDurationMs) / 1000.0, 1) as avg_duration_sec
FROM "CallLog" cl
LEFT JOIN "Contact" c ON cl.contactId = c.id
WHERE
  cl.abTestGroup IS NOT NULL
  AND cl.callStartedAt >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY cl.abTestGroup, c.segment
ORDER BY
  CASE
    WHEN cl.abTestGroup = 'A' THEN 1
    WHEN cl.abTestGroup = 'B' THEN 2
    ELSE 3
  END,
  conversions DESC;

-- ============================================================================
-- Query 4: 주간 진행률 모니터링
-- ============================================================================
-- 목적: 주간 콜 수, 전환 수, 전환율 추이 분석
-- 사용: 목표 대비 진행 상황 점검, 리소스 조정
-- 출력: 주별 A/B 성과

SELECT
  EXTRACT(WEEK FROM cl.callStartedAt) as test_week,
  cl.abTestGroup,
  COUNT(*) as total_calls,
  COUNT(DISTINCT cl.contactId) as unique_contacts,
  SUM(CASE WHEN cl.conversionDay IS NOT NULL THEN 1 ELSE 0 END) as conversions,
  ROUND(100.0 * SUM(CASE WHEN cl.conversionDay IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as conversion_rate,
  ROUND(AVG(cl.callDurationMs) / 1000.0, 1) as avg_duration_sec
FROM "CallLog" cl
WHERE
  cl.abTestGroup IS NOT NULL
  AND cl.callStartedAt >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY test_week, cl.abTestGroup
ORDER BY test_week DESC, cl.abTestGroup;

-- ============================================================================
-- Query 5: 통화 지속 시간 상세 분석
-- ============================================================================
-- 목적: A/B 그룹별 통화 시간 분포 분석 (스크립트 효율성)
-- 사용: 스크립트 길이 평가, 고객 몰입도 측정
-- 출력: 통화 시간 분포, 사분위수

SELECT
  abTestGroup,
  COUNT(*) as total_calls,
  ROUND(AVG(callDurationMs) / 1000.0, 1) as mean_duration_sec,
  ROUND(STDDEV(callDurationMs) / 1000.0, 1) as std_duration_sec,
  ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY callDurationMs) / 1000.0, 1) as q1_duration_sec,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY callDurationMs) / 1000.0, 1) as median_duration_sec,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY callDurationMs) / 1000.0, 1) as q3_duration_sec,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY callDurationMs) / 1000.0, 1) as p95_duration_sec,
  MIN(callDurationMs) / 1000.0 as min_duration_sec,
  MAX(callDurationMs) / 1000.0 as max_duration_sec
FROM "CallLog"
WHERE
  abTestGroup IS NOT NULL
  AND callStartedAt >= CURRENT_DATE - INTERVAL '12 weeks'
  AND callDurationMs IS NOT NULL
GROUP BY abTestGroup
ORDER BY abTestGroup;

-- ============================================================================
-- Query 6: 상담사별 성과 비교 (편향 감지)
-- ============================================================================
-- 목적: 특정 상담사의 성과 편향이 있는지 확인
-- 사용: 데이터 품질 검증, 상담사 교육 필요성 식별
-- 출력: 상담사별 A/B 전환율

SELECT
  cl.userId,
  COALESCE(om.displayName, 'UNKNOWN') as agent_name,
  cl.abTestGroup,
  COUNT(*) as calls,
  SUM(CASE WHEN cl.conversionDay IS NOT NULL THEN 1 ELSE 0 END) as conversions,
  ROUND(100.0 * SUM(CASE WHEN cl.conversionDay IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as conversion_rate,
  ROUND(AVG(cl.callDurationMs) / 1000.0, 1) as avg_duration_sec
FROM "CallLog" cl
LEFT JOIN "OrganizationMember" om ON cl.userId = om.userId
WHERE
  cl.abTestGroup IS NOT NULL
  AND cl.callStartedAt >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY cl.userId, om.displayName, cl.abTestGroup
ORDER BY cl.userId, cl.abTestGroup;

-- ============================================================================
-- Query 7: 통계 검증을 위한 contingency table (χ² 계산용)
-- ============================================================================
-- 목적: 카이제곱 검정에 필요한 2x2 표를 생성
-- 사용: 통계 유의성 계산, 최종 의사결정
-- 출력: A 그룹 전환/미전환, B 그룹 전환/미전환

SELECT
  SUM(CASE WHEN abTestGroup = 'A' AND conversionDay IS NOT NULL THEN 1 ELSE 0 END) as a_conversions,
  SUM(CASE WHEN abTestGroup = 'A' AND conversionDay IS NULL THEN 1 ELSE 0 END) as a_non_conversions,
  SUM(CASE WHEN abTestGroup = 'B' AND conversionDay IS NOT NULL THEN 1 ELSE 0 END) as b_conversions,
  SUM(CASE WHEN abTestGroup = 'B' AND conversionDay IS NULL THEN 1 ELSE 0 END) as b_non_conversions,
  SUM(CASE WHEN conversionDay IS NOT NULL THEN 1 ELSE 0 END) as total_conversions,
  SUM(CASE WHEN conversionDay IS NULL THEN 1 ELSE 0 END) as total_non_conversions,
  COUNT(*) as total_calls
FROM "CallLog"
WHERE
  abTestGroup IN ('A', 'B')
  AND callStartedAt >= CURRENT_DATE - INTERVAL '12 weeks';

-- ============================================================================
-- Query 8: 전환 지연 분석 (conversionDay 분포)
-- ============================================================================
-- 목적: A/B 그룹에서 전환이 언제 발생하는지 분석 (Day 0, 1, 3, 7 등)
-- 사용: 고객 구매 의사결정 타이밍 이해
-- 출력: 각 그룹별 전환 지연 분포

SELECT
  abTestGroup,
  conversionDay,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY abTestGroup), 2) as percentage
FROM "CallLog"
WHERE
  abTestGroup IS NOT NULL
  AND conversionDay IS NOT NULL
  AND callStartedAt >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY abTestGroup, conversionDay
ORDER BY abTestGroup, conversionDay;

-- ============================================================================
-- Notes
-- ============================================================================
-- 1. callStartedAt >= CURRENT_DATE - INTERVAL '12 weeks'
--    → 테스트 기간 중인 데이터만 필터링 (과거 데이터 제외)
--
-- 2. conversionDay IS NOT NULL
--    → 전환으로 판정된 콜 (SMS Day 0/1/3/7 후 재신청)
--
-- 3. PERCENTILE_CONT는 PostgreSQL 함수
--    → MySQL 사용 시 GROUP_CONCAT 또는 다른 함수로 변경
--
-- 4. DATEDIFF는 데이터베이스별로 다름
--    → PostgreSQL: EXTRACT(day FROM ...) 또는 (date1 - date2)
--    → MySQL: DATEDIFF(date1, date2)
--
-- 5. 모든 쿼리는 인덱스 활용 최적화됨
--    → CREATE INDEX idx_calllog_abtest_group ON "CallLog"("abTestGroup");
--    → CREATE INDEX idx_calllog_started_at ON "CallLog"("callStartedAt");
