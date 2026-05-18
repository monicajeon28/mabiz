# Phase 3 월간 점검 템플릿

**점검 기간**: 2026년 __월 1일 ~ __월 말일  
**작성자**: ________________  
**점검 날짜**: 2026년 __월 __일  
**팀**: CRM 운영팀 + 개발팀

---

## 1. 점검 개요

| 항목 | 값 |
|------|-----|
| 검증 크론잡 총 실행 횟수 | __회 (목표: 30회) |
| 정상 알림 | __회 (목표: 30회) |
| 경고 알림 | __회 (목표: 0-1회) |
| 긴급 롤백 | __회 (목표: 0회) |

---

## 2. P1: 데이터 일관성 (99% 이상)

### 2.1 행수 일관성 측정

```sql
-- 실행 결과 복사/붙여넣기
SELECT
  COUNT(*) as execution_log_count,
  (SELECT COUNT(*) FROM sending_history 
   WHERE campaign_id IS NOT NULL 
   AND created_at > NOW() - INTERVAL '30 days') as sending_history_count,
  ROUND(100.0 * 
    COUNT(*) / 
    (SELECT COUNT(*) FROM sending_history 
     WHERE campaign_id IS NOT NULL 
     AND created_at > NOW() - INTERVAL '30 days'),
    2) as consistency_pct
FROM execution_log
WHERE source_type = 'CAMPAIGN'
  AND created_at > NOW() - INTERVAL '30 days';
```

**결과**:
- ExecutionLog 행수: ________________
- SendingHistory 행수: ________________
- 일관성율: __________ % (목표: ≥ 99%)

**판정**:
- [ ] ✅ PASS (≥ 99%)
- [ ] 🟡 WARN (95-99%)
- [ ] 🔴 FAIL (< 95%)

**분석**:
- 지난달과의 변화: __________ %
- 추이 평가: 상향 / 정상 / 하향
- 원인 분석 (경고/실패시):
  ```
  
  ```

---

### 2.2 채널별 분포 검증

```sql
-- SendingHistory 채널 분포
SELECT
  channel,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as pct
FROM sending_history
WHERE campaign_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY channel
ORDER BY channel;

-- ExecutionLog 채널 분포
SELECT
  channel,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as pct
FROM execution_log
WHERE source_type = 'CAMPAIGN'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY channel
ORDER BY channel;
```

**결과**:

| 채널 | SendingHistory % | ExecutionLog % | 차이 |
|------|-----------------|-----------------|------|
| SMS | ________% | ________% | ________% |
| EMAIL | ________% | ________% | ________% |
| 동기화율 | - | - | ________% |

**판정**:
- [ ] ✅ PASS (동기화율 ≥ 99%)
- [ ] 🟡 WARN (동기화율 95-99%)
- [ ] 🔴 FAIL (동기화율 < 95%)

**분석**:
```

```

---

## 3. P2: Enum Fallback 감소 추이

```typescript
// 최근 30일 Fallback 발생 건수
SELECT
  COUNT(*) as fallback_count,
  COUNT(DISTINCT DATE(created_at)) as days_with_fallback
FROM execution_log
WHERE status = 'FALLBACK'
  AND created_at > NOW() - INTERVAL '30 days';

// 일별 추이
SELECT
  DATE(created_at) as date,
  COUNT(*) as fallback_count
FROM execution_log
WHERE status = 'FALLBACK'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**결과**:
- 총 Fallback 건수: __________ 건 (목표: 0건)
- Fallback 발생 일수: __________ 일
- 지난달 대비 변화: __________ % (증감)

**판정**:
- [ ] ✅ PASS (0건)
- [ ] 🟡 WARN (1-10건)
- [ ] 🔴 FAIL (> 10건)

**상위 원인 분석**:

```sql
SELECT
  COUNT(*) as count,
  -- fallback_reason 또는 NULL 원인 분석
  'Unknown reason' as probable_cause
FROM execution_log
WHERE status = 'FALLBACK'
  AND created_at > NOW() - INTERVAL '30 days'
LIMIT 5;
```

| 순위 | 원인 | 건수 |
|------|------|------|
| 1 | __________ | __ |
| 2 | __________ | __ |
| 3 | __________ | __ |

**대응 계획** (Fallback > 0인 경우):
- 원인: __________
- 조치: __________
- 담당자: __________
- 예상 완료: 2026년 __월 __일

---

## 4. P3: 자동 복구 성공률 (100% 목표)

```sql
-- 지난 30일 롤백 이벤트
SELECT
  COUNT(*) as total_events,
  COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as success_count,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count,
  ROUND(100.0 * 
    COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) / 
    NULLIF(COUNT(*), 0),
    2) as success_rate
FROM rollback_event
WHERE created_at > NOW() - INTERVAL '30 days';
```

**결과**:
- 총 롤백 이벤트: __________ 회
  - 자동 롤백: __________ 회
  - 수동 롤백: __________ 회
- 성공 건수: __________ 회
- 실패 건수: __________ 회
- 성공률: __________ % (목표: 100%)

**판정**:
- [ ] ✅ PASS (100% 또는 0회)
- [ ] 🟡 WARN (90-100%)
- [ ] 🔴 FAIL (< 90%)

**개별 이벤트 분석** (롤백 발생시):

```sql
SELECT
  id,
  triggered_at,
  reason,
  status,
  recovery_time_seconds,
  notes
FROM rollback_event
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY triggered_at DESC;
```

| 번호 | 발생일시 | 원인 | 상태 | 복구시간 | 메모 |
|------|----------|------|------|----------|------|
| 1 | __________ | __________ | ✅/❌ | __초 | __________ |

**분석**:
```

```

---

## 5. P4: 모니터링 API 대시보드 가동

### 5.1 엔드포인트 통신 테스트

```bash
# 현재 상태 조회
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  https://crm.mabiz.co.kr/api/admin/verification/status

응답 코드: __________ (목표: 200)

응답 본문 예시:
{
  "timestamp": "2026-05-19T10:00:00Z",
  "isHealthy": true,
  "consistency": 98.5,
  "channelSyncRate": 99.8,
  "campaignFilterAccuracy": 100.0,
  "timestampP99": 0.2,
  "rollbackTriggered": false,
  "lastVerificationAt": "2026-05-19T06:00:30Z",
  "nextVerificationAt": "2026-05-20T06:00:00Z"
}
```

**판정**:
- [ ] ✅ PASS (HTTP 200 + 모든 필드 포함)
- [ ] 🔴 FAIL (HTTP 4xx/5xx 또는 필드 누락)

---

### 5.2 이력 데이터 조회

```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  'https://crm.mabiz.co.kr/api/admin/verification/history?days=30'

응답 코드: __________
반환된 레코드 수: __________ 개 (목표: 30개)
```

**판정**:
- [ ] ✅ PASS (HTTP 200 + 30개 레코드)
- [ ] 🟡 WARN (HTTP 200이지만 < 30개)
- [ ] 🔴 FAIL (HTTP 4xx/5xx)

---

## 6. P5: 롤백 발생 근본 원인 분석

### 6.1 롤백 요약

```markdown
이번달 롤백 발생: __________ 회

건별 상세:

1. 발생일시: 2026-05-____ 06:00
   - 일관성: __________%
   - 임계값: 95% (현재 __% < 95%)
   - 원인: _________________
   - 조치: _________________
   - 소요시간: ____분

2. ...
```

### 6.2 근본 원인 카테고리

**해당 사항 선택** (복수 선택 가능):

- [ ] A. 데이터 입수 지연 (SendingHistory 미수신)
- [ ] B. ExecutionLog 쓰기 실패 (DB 오류)
- [ ] C. 채널 분포 편중 (특정 채널 폭증)
- [ ] D. 타임스탬프 동기화 오류
- [ ] E. 캠페인 필터 오류 (sourceType/campaignId 불일치)
- [ ] F. 기타: __________________

### 6.3 재발 방지 계획

| 카테고리 | 근본 원인 | 예방 조치 | 담당자 | 완료일 |
|----------|----------|----------|--------|--------|
| A | ______ | ______ | ____ | 2026-06-__ |

---

## 7. P6: Rate Limit 정책 효과

```sql
-- 최근 30일 API 호출 분포
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as api_call_count,
  COUNT(CASE WHEN http_status >= 429 THEN 1 END) as rate_limit_hits,
  ROUND(100.0 * COUNT(CASE WHEN http_status >= 429 THEN 1 END) / 
    NULLIF(COUNT(*), 0), 2) as rate_limit_pct
FROM api_request_logs
WHERE api_endpoint IN (
  '/api/campaign/list',
  '/api/campaign/detail',
  '/api/execution-log/get'
)
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

**결과**:
- 총 API 호출: __________ 건
- Rate Limit 발생: __________ 회
- Rate Limit 비율: __________ % (목표: < 1%)

**판정**:
- [ ] ✅ PASS (< 1%)
- [ ] 🟡 WARN (1-5%)
- [ ] 🔴 FAIL (≥ 5%)

**분석**:
- 가장 많이 제한된 엔드포인트: __________________
- 예상 원인: __________________

---

## 8. P7: 팀 피드백 수집

### 8.1 익명 투표 결과

> Slack 또는 구글 폼으로 수집

**1. 모니터링 알림 품질 (1-5점 평가)**

| 항목 | 평균점 | 목표 | 상태 |
|------|--------|------|------|
| 관련성 있음 | ______점 | 4점 이상 | ✅/❌ |
| 이해하기 쉬움 | ______점 | 4점 이상 | ✅/❌ |
| 시기 적절함 | ______점 | 4점 이상 | ✅/❌ |

---

**2. 운영 편의성 (Yes/No)**

```
현재 체크리스트가 효과적인가?
□ Yes (이유: ______________)
□ No (개선사항: ______________)

개선이 필요한 항목:
□ 일일 점검 절차
□ 주간 점검 절차
□ 월간 점검 절차
□ 알림 형식
□ API 문서
□ 기타: __________________
```

---

**3. 시스템 안정성 신뢰도 (1-5점)**

| 항목 | 점수 | 개선사항 |
|------|------|----------|
| ExecutionLog 신뢰 | ______점 | ______________ |
| 롤백 메커니즘 신뢰 | ______점 | ______________ |
| 전체 시스템 | ______점 | ______________ |

---

**4. 자유 의견**

```

팀원 의견:
- __________________
- __________________
- __________________
```

---

## 9. 종합 판정 및 조치

### 9.1 각 항목 최종 판정

| P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|----|----|----|----|----|----|-----|
| ✅/🟡/🔴 | ✅/🟡/🔴 | ✅/🟡/🔴 | ✅/🔴 | ✅/🟡/🔴 | ✅/🟡/🔴 | ✅/🟡 |

### 9.2 종합 평가

**전체 상태**:
- [ ] ✅ **정상** (P1-6 모두 ✅, P7 ≥4점)
- [ ] 🟡 **주의** (P1-6 중 🟡 1-2개)
- [ ] 🔴 **위험** (P1-6 중 🔴 1개 이상)

**정성 평가**:
```

이번달 주요 성과:
- __________________
- __________________

개선이 필요한 부분:
- __________________
- __________________

다음달 우선순위:
1. __________________
2. __________________
3. __________________
```

---

## 10. 조치 항목 (높음 → 중간 → 낮음)

### 높음 우선순위 (다음주 처리)

| 항목 | 담당자 | 완료일 | 진행상황 |
|------|--------|--------|---------|
| P2 Fallback 원인 분석 | ______ | 2026-06-07 | □ |
| P3 롤백 원인 분석 | ______ | 2026-06-07 | □ |

### 중간 우선순위 (다음달 말까지)

| 항목 | 담당자 | 완료일 | 진행상황 |
|------|--------|--------|---------|
| Grafana 대시보드 구축 | ______ | 2026-06-30 | □ |
| API 문서 보강 | ______ | 2026-06-30 | □ |

### 낮음 우선순위 (별도 계획)

| 항목 | 담당자 | 예상 시기 |
|------|--------|----------|
| Phase 4 확장성 검토 | ______ | 2026년 Q3 |

---

## 11. 참석자 서명

| 역할 | 이름 | 서명 | 날짜 |
|------|------|------|------|
| CRM 팀장 | ________________ | ________ | 2026-05-__ |
| 개발팀 리드 | ________________ | ________ | 2026-05-__ |
| 운영팀 대표 | ________________ | ________ | 2026-05-__ |

---

## 12. 다음월 예정

- **다음 점검일**: 2026년 6월 __일 (목요일)
- **점검 범위**: 2026년 6월 1일 ~ 6월 30일
- **준비사항**: 
  - [ ] 데이터 수집 준비
  - [ ] 팀 일정 확인
  - [ ] 대시보드 업데이트

---

## 참고: 빠른 데이터 수집 스크립트

```bash
#!/bin/bash
# 한 번에 모든 데이터 수집

ADMIN_TOKEN="your-token-here"
MONTH="05"
YEAR="2026"

echo "=== ExecutionLog 일관성 ==="
psql -h neon.tech -d crm_db -c "
SELECT
  COUNT(*) as execution_log_count,
  (SELECT COUNT(*) FROM sending_history 
   WHERE campaign_id IS NOT NULL 
   AND created_at > NOW() - INTERVAL '30 days') as sending_history_count,
  ROUND(100.0 * COUNT(*) / 
    (SELECT COUNT(*) FROM sending_history 
     WHERE campaign_id IS NOT NULL 
     AND created_at > NOW() - INTERVAL '30 days'), 2) as consistency_pct
FROM execution_log
WHERE source_type = 'CAMPAIGN'
  AND created_at > NOW() - INTERVAL '30 days';
"

echo -e "\n=== Fallback 건수 ==="
psql -h neon.tech -d crm_db -c "
SELECT COUNT(*) as fallback_count FROM execution_log
WHERE status = 'FALLBACK' AND created_at > NOW() - INTERVAL '30 days';
"

echo -e "\n=== API 상태 ==="
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://crm.mabiz.co.kr/api/admin/verification/status | jq .

echo "✅ 데이터 수집 완료"
```

---

**문의**: CRM 팀장 (Slack #crm-ops) | **버전**: 1.0 | **최종 수정**: 2026-05-19
