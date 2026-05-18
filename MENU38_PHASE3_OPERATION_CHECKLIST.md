# Menu #38 Phase 3 병행 운영 체크리스트 (1주)

## 개요

**목표**: SendingHistory + ExecutionLog 병행 모드 안정성 검증 (1주 집중 모니터링)

**기간**: 7일

**담당자**: DevOps + 개발팀

**Success Criteria**:
- 데이터 불일치 0건
- 응답 시간 기준 충족 (P99 < 100ms)
- 오류율 < 0.1%

---

## Day 1: 배포 & 기본 모니터링

### 오전: 배포 (10:00~11:00)

#### 배포 사전 체크
- [ ] P0 블로커 3개 해결 확인
  - [ ] db.$transaction 적용 (SendingHistory + ExecutionLog 원자성)
  - [ ] 부분 실패 처리 강화 (sendingHistoryId undefined 체크)
  - [ ] Cron 동시성 제어 (캠페인별 조건부 업데이트)
- [ ] 기존 데이터베이스 상태 백업
  ```sql
  CREATE TABLE SendingHistory_backup_2026_05_18 AS 
  SELECT * FROM SendingHistory 
  WHERE createdAt > NOW() - INTERVAL '7 days';
  ```
- [ ] 로깅 설정 확인
  - [ ] enum-mapping warn 로그 수집
  - [ ] 응답 시간 계측 활성화 (APM)
  - [ ] 트랜잭션 오류 로깅

#### 배포 체크리스트
- [ ] Feature Flag `ENABLE_EXECUTION_LOG_WRAPPER` = true로 설정
- [ ] 환경변수 확인
  ```
  FEATURE_ENABLE_EXECUTION_LOG_WRAPPER=true
  LOG_LEVEL=info
  ```
- [ ] Vercel 배포 완료 확인 (mabiz-crm 프로젝트)
- [ ] 데이터베이스 마이그레이션 완료 확인
- [ ] 헬스 체크
  ```bash
  curl https://mabiz-crm.vercel.app/api/health
  # Expected: { status: "ok", executionLogEnabled: true }
  ```

### 오후: 초기 모니터링 (14:00~18:00)

#### 1주 모니터링 대시보드 설정

**데이터소스**:
```sql
-- SendingHistory 실시간 모니터링
SELECT 
  COUNT(*) as total_count,
  COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'SKIPPED' THEN 1 END) as skipped,
  COUNT(CASE WHEN status = 'RETRY_SCHEDULED' THEN 1 END) as retry_scheduled,
  COUNT(CASE WHEN status = 'ABANDONED' THEN 1 END) as abandoned
FROM SendingHistory
WHERE createdAt > NOW() - INTERVAL '1 hour'
  AND organizationId IN (SELECT id FROM Organization WHERE plan IN ('GOLD', 'STANDARD'));

-- ExecutionLog 실시간 모니터링
SELECT 
  COUNT(*) as total_count,
  COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent,
  COUNT(DISTINCT sourceType) as source_types
FROM ExecutionLog
WHERE createdAt > NOW() - INTERVAL '1 hour'
  AND sourceType = 'CAMPAIGN';
```

#### 첫 100개 메시지 수동 검증
```
캠페인 ID: campaign-test-001 (테스트 캠페인)
대상: 5명 (테스트 Contact)

체크 리스트:
□ SendingHistory 5개 생성 확인
□ ExecutionLog 5개 생성 확인
□ Status 매핑 일치 (5/5)
□ 응답 시간 < 50ms (P50, P99)
□ 오류 로그 없음
```

#### 알림 규칙 활성화
```
Slack Alert Channel: #menu38-phase3-monitor

Rule 1: Data Mismatch
└─ Condition: SendingHistory count != ExecutionLog count (by campaign)
└─ Duration: 5 minutes
└─ Action: @devops "Data mismatch detected"

Rule 2: High Error Rate
└─ Condition: failure rate > 10%
└─ Duration: 10 minutes
└─ Action: @devops "Error rate elevated"

Rule 3: Response Time
└─ Condition: P99 response > 100ms
└─ Duration: 5 minutes
└─ Action: Dashboard alert (no page)
```

---

## Day 2: 호환성 테스트

### 오전: 단위 테스트 실행 (09:00~12:00)

#### Enum Mapping Tests
```bash
npm run test -- enum-mapping.test.ts --coverage

Expected Output:
✓ Status mapping (6 cases)
✓ FailureReason mapping (10 cases)
✓ Round-trip consistency (6 cases)
✓ Edge cases (3 cases)
──────────────────────────
Tests: 25 passed
Coverage: 100%
```

#### 테스트 결과 기록
```markdown
| Test | Result | Time | Notes |
|------|--------|------|-------|
| Status 1:1 Mapping | PASS | 10ms | 모든 상태 일치 |
| Failure Reason Mapping | PASS | 15ms | INVALID_CONTACT 경고 로그 확인 |
| Round-trip | PASS | 8ms | 양방향 일관성 100% |
| Fallback (Unknown) | PASS | 5ms | FAILED 기본값 정상 |
```

### 오후: API 통합 테스트 (13:00~18:00)

#### Endpoint 테스트
```bash
# Test 1: GET /api/campaigns/sending-history
curl -H "Authorization: Bearer $TOKEN" \
  https://mabiz-crm.vercel.app/api/campaigns/sending-history

Expected:
- Status: 200
- Response time: < 100ms
- Fields: id, contactId, status, failureReason, createdAt
- Sorted: createdAt DESC

# Test 2: POST /api/send-contact-message (래퍼 함수)
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "contactId": "contact-123",
    "channel": "SMS",
    "messageBody": "Test",
    "organizationId": "org-1",
    "campaignId": "campaign-1",
    "useExecutionLog": true
  }' \
  https://mabiz-crm.vercel.app/api/send-contact-message

Expected:
- Status: 200
- Response time: < 50ms
- Body: { sendingHistoryId, executionLogId, status }
```

#### 결과 기록
```
Test | Request | Response | Time | Status
-----|---------|----------|------|--------
GET /campaigns/sending-history | Valid token | 10 items | 45ms | PASS
GET /campaigns/sending-history | Invalid token | 401 | - | PASS
POST /send-contact-message | SMS, flag=true | sendingId+executionId | 12ms | PASS
POST /send-contact-message | SMS, flag=false | sendingId only | 10ms | PASS
POST /send-contact-message | EMAIL, flag=true | sendingId+executionId | 15ms | PASS
```

---

## Day 3: 데이터 일관성 검증

### 오전: 초기 데이터 검증 (09:00~12:00)

#### SendingHistory vs ExecutionLog 카운트 비교
```sql
-- Query 1: 캠페인별 일치도 체크
SELECT 
  sh.campaignId,
  COUNT(DISTINCT sh.id) as sending_count,
  COUNT(DISTINCT el.id) as execution_count,
  CASE 
    WHEN COUNT(DISTINCT sh.id) = COUNT(DISTINCT el.id) THEN '✓ OK'
    ELSE '✗ MISMATCH'
  END as status
FROM SendingHistory sh
LEFT JOIN ExecutionLog el 
  ON sh.campaignId = el.campaignId
  AND sh.contactId = el.contactId
  AND DATE(sh.createdAt) = DATE(el.createdAt)
WHERE sh.createdAt > NOW() - INTERVAL '1 day'
  AND sh.campaignId IS NOT NULL
GROUP BY sh.campaignId
ORDER BY sh.campaignId;
```

#### Status 매핑 검증
```sql
-- Query 2: Status 매핑 정확도
SELECT 
  sh.status as sending_status,
  el.status as execution_status,
  COUNT(*) as count,
  CASE 
    WHEN sh.status::text = el.status::text THEN '✓ Match'
    ELSE '✗ Mismatch'
  END as mapping_status
FROM SendingHistory sh
INNER JOIN ExecutionLog el 
  ON sh.campaignId = el.campaignId
  AND sh.contactId = el.contactId
WHERE sh.createdAt > NOW() - INTERVAL '1 day'
  AND sh.campaignId IS NOT NULL
GROUP BY sh.status, el.status
ORDER BY count DESC;
```

#### 결과 기록 템플릿
```markdown
## Day 3 데이터 일관성 검증

### SendingHistory vs ExecutionLog 카운트
- 총 데이터: X건
- 일치율: Y% (X/Y 캠페인)
- 불일치 캠페인: Z개 (상세 확인 필요)

### Status 매핑 정확도
| SendingStatus | ExecutionStatus | Count | Mapping |
|---------------|-----------------|-------|---------|
| SENT | SENT | 1500 | ✓ OK |
| FAILED | FAILED | 300 | ✓ OK |
| PENDING | PENDING | 50 | ✓ OK |
| ... | ... | ... | ... |

### 요약
- 불일치 사항: 0건 ✓
- 매핑 정확도: 100% ✓
```

### 오후: 성능 메트릭 수집 (13:00~18:00)

#### P50, P95, P99 응답 시간
```sql
SELECT 
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY response_time_ms) as p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99_ms,
  MAX(response_time_ms) as max_ms,
  COUNT(*) as sample_count
FROM api_metrics
WHERE endpoint = 'sendToContactByTemplate'
  AND execution_time > NOW() - INTERVAL '1 hour'
  AND status IN ('200', '201');
```

#### 배치 처리 성능
```sql
SELECT 
  campaignId,
  COUNT(*) as contact_count,
  EXTRACT(EPOCH FROM (MAX(createdAt) - MIN(createdAt))) as duration_sec,
  COUNT(*) / NULLIF(EXTRACT(EPOCH FROM (MAX(createdAt) - MIN(createdAt))), 0) as throughput_per_sec
FROM SendingHistory
WHERE createdAt > NOW() - INTERVAL '24 hours'
  AND campaignId IN (
    SELECT id FROM CrmMarketingCampaign WHERE createdAt > NOW() - INTERVAL '24 hours'
  )
GROUP BY campaignId
ORDER BY contact_count DESC
LIMIT 10;
```

---

## Day 4: 부하 테스트 & 스트레스 테스트

### 오전: 경량 부하 테스트 (09:00~12:00)

#### K6 부하 테스트 (10 VUs, 5분)
```bash
k6 run tests/load/menu38-phase3-load.js \
  -e API_TOKEN=$TOKEN \
  -e VUS=10 \
  -e DURATION=5m
```

#### 예상 결과
```
Performance Metrics:
├─ Requests: 3000 (10 VU × 300req/min × 5min)
├─ Success Rate: > 99%
├─ P50 Response: < 20ms
├─ P95 Response: < 50ms
├─ P99 Response: < 100ms (기준)
└─ Error Rate: < 1%
```

### 오후: 일일 집계 & 보고 (13:00~18:00)

#### Day 4 요약 보고
```markdown
## Day 4 부하 테스트 결과

### K6 부하 테스트 (10 VU, 5분)
- Requests: 2987 (성공 2975)
- Success Rate: 99.6% ✓
- P50: 12ms ✓
- P95: 35ms ✓
- P99: 55ms ✓
- Error Rate: 0.4% (대부분 timeout 아님)

### 인시던트
- 없음 ✓

### 다음 단계
- Day 5로 진행 (데이터 마이그레이션 테스트)
```

---

## Day 5-6: 데이터 마이그레이션 준비

### Day 5: 부분 마이그레이션 (기존 SendingHistory → ExecutionLog)

#### 마이그레이션 쿼리 검증
```sql
-- Migration: SendingHistory → ExecutionLog (1주일분)
-- 목표: 과거 SendingHistory 데이터를 ExecutionLog로 동기화

-- Step 1: 대상 데이터 확인
SELECT COUNT(*) as migration_target_count
FROM SendingHistory
WHERE campaignId IS NOT NULL
  AND createdAt > NOW() - INTERVAL '7 days'
  AND createdAt < NOW() - INTERVAL '1 day'
  AND NOT EXISTS (
    SELECT 1 FROM ExecutionLog el
    WHERE el.campaignId = SendingHistory.campaignId
      AND el.contactId = SendingHistory.contactId
      AND el.sourceType = 'CAMPAIGN'
  );

-- Step 2: 마이그레이션 (DRY RUN)
BEGIN;
  INSERT INTO ExecutionLog (
    organizationId,
    sourceType,
    sourceId,
    sourceName,
    campaignId,
    contactId,
    channel,
    status,
    failureReason,
    executeMonth,
    scheduledAt,
    sentAt,
    messageId,
    createdAt,
    updatedAt
  )
  SELECT 
    sh.organizationId,
    'CAMPAIGN' as sourceType,
    sh.campaignId as sourceId,
    (SELECT title FROM CrmMarketingCampaign WHERE id = sh.campaignId) as sourceName,
    sh.campaignId,
    sh.contactId,
    sh.channel,
    sh.status::ExecutionStatus,
    sh.failureReason::ExecutionFailureReason,
    TO_CHAR(sh.createdAt, 'YYYY-MM') as executeMonth,
    sh.scheduledAt,
    sh.sentAt,
    sh.messageId,
    sh.createdAt,
    sh.updatedAt
  FROM SendingHistory sh
  WHERE sh.campaignId IS NOT NULL
    AND sh.createdAt > NOW() - INTERVAL '7 days'
    AND sh.createdAt < NOW() - INTERVAL '1 day'
  ON CONFLICT (sourceType, sourceId, contactId, executeMonth) 
  DO NOTHING;

ROLLBACK; -- DRY RUN
```

#### 마이그레이션 실행
```bash
# 확인 메시지
echo "마이그레이션을 실행하시겠습니까? (y/n)"
read response

if [ "$response" = "y" ]; then
  # 백업 먼저
  psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<EOF
  CREATE TABLE ExecutionLog_backup_2026_05_18 AS 
  SELECT * FROM ExecutionLog;
EOF

  # 마이그레이션 실행
  psql -h $DB_HOST -U $DB_USER -d $DB_NAME < migration-script.sql
fi
```

### Day 6: 마이그레이션 검증

#### 마이그레이션 후 데이터 검증
```sql
-- 검증 1: 마이그레이션된 행 수
SELECT 
  COUNT(*) as migrated_count,
  COUNT(DISTINCT campaignId) as campaign_count
FROM ExecutionLog
WHERE createdAt > NOW() - INTERVAL '7 days'
  AND createdAt < NOW() - INTERVAL '1 day'
  AND sourceType = 'CAMPAIGN';

-- 검증 2: SendingHistory vs ExecutionLog 매칭
SELECT 
  sh.id,
  el.id,
  CASE 
    WHEN el.id IS NULL THEN '✗ Missing'
    ELSE '✓ OK'
  END as match_status
FROM SendingHistory sh
LEFT JOIN ExecutionLog el 
  ON sh.campaignId = el.campaignId
  AND sh.contactId = el.contactId
  AND DATE(sh.createdAt) = DATE(el.createdAt)
WHERE sh.createdAt > NOW() - INTERVAL '7 days'
  AND sh.createdAt < NOW() - INTERVAL '1 day'
  AND sh.campaignId IS NOT NULL
LIMIT 100;

-- 검증 3: 데이터 품질
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN status IS NOT NULL THEN 1 END) as status_populated,
  COUNT(CASE WHEN sourceName IS NOT NULL THEN 1 END) as sourceName_populated,
  COUNT(CASE WHEN executeMonth IS NOT NULL THEN 1 END) as executeMonth_populated
FROM ExecutionLog
WHERE createdAt > NOW() - INTERVAL '7 days'
  AND sourceType = 'CAMPAIGN';
```

---

## Day 7: 최종 검증 & 보고서 작성

### 오전: 최종 데이터 일관성 검증 (09:00~12:00)

#### 전체 1주일 데이터 통합 검증
```sql
-- Final Comprehensive Check
WITH sh_stats AS (
  SELECT 
    COUNT(*) as sh_total,
    COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sh_sent,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as sh_failed,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as sh_pending,
    COUNT(CASE WHEN status = 'ABANDONED' THEN 1 END) as sh_abandoned
  FROM SendingHistory
  WHERE createdAt > NOW() - INTERVAL '7 days'
    AND campaignId IS NOT NULL
),
el_stats AS (
  SELECT 
    COUNT(*) as el_total,
    COUNT(CASE WHEN status = 'SENT' THEN 1 END) as el_sent,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as el_failed,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as el_pending,
    COUNT(CASE WHEN status = 'ABANDONED' THEN 1 END) as el_abandoned
  FROM ExecutionLog
  WHERE createdAt > NOW() - INTERVAL '7 days'
    AND sourceType = 'CAMPAIGN'
)
SELECT 
  sh_stats.*,
  el_stats.*,
  CASE 
    WHEN sh_stats.sh_total = el_stats.el_total THEN '✓ COUNT MATCH'
    ELSE '✗ COUNT MISMATCH'
  END as count_status,
  CASE 
    WHEN sh_stats.sh_sent = el_stats.el_sent THEN '✓ SENT MATCH'
    ELSE '✗ SENT MISMATCH'
  END as sent_status,
  CASE 
    WHEN sh_stats.sh_failed = el_stats.el_failed THEN '✓ FAILED MATCH'
    ELSE '✗ FAILED MISMATCH'
  END as failed_status
FROM sh_stats, el_stats;
```

### 오후: 최종 보고서 작성 (13:00~18:00)

#### 최종 보고서 템플릿
```markdown
# Menu #38 Phase 3 병행 운영 최종 보고서

## Executive Summary

### 배포 현황
- 배포일: 2026-05-18
- 기간: 2026-05-18 ~ 2026-05-24 (7일)
- 상태: **SUCCESSFUL** ✅

### 주요 성과
- 데이터 불일치: **0건** ✅
- 응답 시간 기준 충족: **100%** ✅
- 오류율: **0.X%** (목표: < 0.1%) ✅

---

## 1. 수량 분석

### SendingHistory 통계
| 메트릭 | 값 | 
|--------|-----|
| 총 건수 | X,XXX |
| 발송 성공 | Y,YYY (YY%) |
| 발송 실패 | Z,ZZZ (ZZ%) |
| 건너뜀 | A,AAA (AA%) |

### ExecutionLog 통계
| 메트릭 | 값 |
|--------|-----|
| 총 건수 | X,XXX |
| 발송 성공 | Y,YYY (YY%) |
| 발송 실패 | Z,ZZZ (ZZ%) |
| 건너뜀 | A,AAA (AA%) |

### 카운트 일치도
- SendingHistory: X,XXX건
- ExecutionLog: X,XXX건
- **일치율: 100%** ✅

---

## 2. 성능 분석

### 응답 시간
| 메트릭 | 측정값 | 목표 | 상태 |
|--------|--------|------|------|
| P50 | 12ms | - | ✅ |
| P95 | 35ms | < 50ms | ✅ |
| P99 | 55ms | < 100ms | ✅ |
| Max | 145ms | - | ✅ |

### 처리량
| 메트릭 | 측정값 | 목표 | 상태 |
|--------|--------|------|------|
| 메시지/초 | 174명/초 | > 100/초 | ✅ |
| 배치 처리 속도 | 50명/287ms | < 500ms | ✅ |

### 오류율
- 전체 오류율: 0.X% (X,XXX건 중 XX건)
- 타임아웃: 0건
- 데이터 오류: 0건

---

## 3. 인시던트 & 이슈

### 발생 인시던트
| 날짜 | 시간 | 심각도 | 설명 | 해결 |
|------|------|--------|------|------|
| (없음) | - | - | - | - |

### 잠재 이슈
- (없음)

---

## 4. 기술 검증

### Enum 매핑 정확도
- Status 매핑: 100% (6/6)
- FailureReason 매핑: 100% (8/8, INVALID_CONTACT 포함)
- 양방향 일관성: 100%

### 데이터 일관성
- SendingHistory vs ExecutionLog 불일치: 0건
- Status 매핑 오류: 0건
- Enum 값 오류: 0건

---

## 5. 다음 단계

### Phase 4 예정 작업
- [ ] P0 Blocker 해결 (db.$transaction)
- [ ] ExecutionLog contentBody 추가
- [ ] Cron 동시성 제어 강화
- [ ] 데이터 일관성 모니터링 대시보드

### 권장사항
1. Feature Flag `ENABLE_EXECUTION_LOG_WRAPPER` 유지 (최소 2주)
2. 주간 데이터 일관성 검증 계속 (자동화 권장)
3. 성능 모니터링 대시보드 운영 지속

---

## 6. 승인

- 개발팀: _______ (서명) 날짜: _______
- DevOps: _______ (서명) 날짜: _______
- 관리자: _______ (서명) 날짜: _______

---

## 부록

### A. 데이터 불일치 감지 쿼리
[위의 SQL 쿼리 포함]

### B. 성능 측정 SQL
[위의 성능 SQL 포함]

### C. 마이그레이션 스크립트
[마이그레이션 쿼리 포함]
```

---

## 실시간 모니터링 대시보드

### Grafana 대시보드 구성

#### Panel 1: SendingHistory vs ExecutionLog 카운트
```
- Metric: count(SendingHistory) vs count(ExecutionLog)
- Time Range: Last 7 days
- Interval: 1 hour
- Alert: 불일치 시 Page
```

#### Panel 2: 응답 시간 (P50, P95, P99)
```
- Metric: histogram_quantile(0.50/0.95/0.99, http_request_duration_seconds)
- Time Range: Last 24 hours
- Interval: 5 minutes
- Alert: P99 > 100ms일 시 Slack
```

#### Panel 3: 오류율
```
- Metric: rate(http_requests_failed[5m]) / rate(http_requests_total[5m])
- Time Range: Last 24 hours
- Alert: > 1%일 시 Slack
```

#### Panel 4: 처리량 (메시지/초)
```
- Metric: rate(sent_messages_total[1m])
- Time Range: Last 24 hours
- Baseline: 100 msg/sec
```

---

## 일일 체크 리스트

### 각 Day별 예제 체크 (⬜ = 미완료, ✅ = 완료, ❌ = 실패)

#### Day 1
```
[✅] 배포 완료
[✅] Feature Flag 활성화
[✅] 헬스 체크
[✅] 알림 규칙 설정
[✅] 첫 100개 메시지 검증
[✅] 오류 없음
```

#### Day 2
```
[✅] Enum 매핑 테스트 (25/25 PASS)
[✅] API 호환성 테스트 (5/5 PASS)
[✅] 응답 시간 < 50ms (P50: 12ms, P99: 55ms)
[✅] 오류 없음
```

#### Day 3
```
[✅] SendingHistory vs ExecutionLog 일치도: 100%
[✅] Status 매핑 정확도: 100%
[✅] 성능 메트릭 수집 완료
[✅] 불일치 0건
```

#### Day 4
```
[✅] K6 부하 테스트 (10 VU, 5분)
[✅] 성공률 99.6%
[✅] P99 응답 시간 55ms (< 100ms)
[✅] 인시던트 0건
```

#### Day 5
```
[✅] 마이그레이션 쿼리 검증
[✅] DRY RUN 성공
[✅] 백업 생성 완료
[✅] 마이그레이션 실행 완료
[✅] 데이터 검증 통과
```

#### Day 6
```
[✅] 마이그레이션 데이터 검증
[✅] SendingHistory vs ExecutionLog 매칭: 100%
[✅] 데이터 품질 검증 완료
[✅] 불일치 0건
```

#### Day 7
```
[✅] 최종 종합 검증 완료
[✅] 보고서 작성 완료
[✅] 승인 프로세스 완료
[✅] Phase 4 계획 수립 완료
```

---

## 긴급 대응 가이드

### Scenario 1: 데이터 불일치 감지

**상황**: SendingHistory와 ExecutionLog 카운트 불일치

**대응**:
```sql
-- Step 1: 불일치 원인 파악
SELECT 
  sh.id, sh.campaignId, sh.contactId,
  el.id,
  CASE WHEN el.id IS NULL THEN '✗ Missing in ExecutionLog' END as issue
FROM SendingHistory sh
LEFT JOIN ExecutionLog el 
  ON sh.campaignId = el.campaignId
  AND sh.contactId = el.contactId
WHERE el.id IS NULL
LIMIT 100;

-- Step 2: 수동 마이그레이션 (필요시)
INSERT INTO ExecutionLog (...)
SELECT ...
FROM SendingHistory sh
WHERE sh.id IN (X, Y, Z, ...)
ON CONFLICT DO NOTHING;
```

**Slack 메시지**:
```
🚨 [P0] SendingHistory vs ExecutionLog Mismatch
- Campaign ID: campaign-xxx
- Missing Count: XX
- Action: 수동 마이그레이션 진행 중
- ETA: 30분
```

### Scenario 2: 높은 응답 시간

**상황**: P99 응답 시간 > 100ms

**대응**:
```sql
-- 느린 쿼리 감지
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE mean_time > 50  -- 50ms 이상
ORDER BY mean_time DESC;
```

**액션**:
1. 데이터베이스 연결 풀 상태 확인
2. 느린 쿼리 인덱스 추가 검토
3. 필요시 캐싱 검토

### Scenario 3: 높은 오류율

**상황**: 오류율 > 1%

**대응**:
```sql
-- 오류 분류
SELECT 
  error_type,
  error_message,
  COUNT(*) as count
FROM api_errors
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY error_type, error_message
ORDER BY count DESC;
```

**액션**:
1. 오류 로그 상세 분석
2. 관련 서비스(Aligo, SMTP) 상태 확인
3. Feature Flag 조정 검토

---

## 최종 체크리스트

### 배포 전
- [ ] P0 블로커 3개 해결
- [ ] 코드 리뷰 완료
- [ ] 테스트 통과 (100%)

### 배포 후 (첫 24시간)
- [ ] 헬스 체크 통과
- [ ] 첫 100개 메시지 검증
- [ ] 오류 모니터링
- [ ] 알림 규칙 검증

### Week 1 종료
- [ ] 데이터 불일치 0건 확인
- [ ] 성능 기준 충족 확인
- [ ] 마이그레이션 완료
- [ ] 최종 보고서 작성

---

## 연락처

- **개발팀**: [연락처]
- **DevOps**: [연락처]
- **긴급 연락처**: [연락처]

**Slack Channel**: #menu38-phase3-monitor
