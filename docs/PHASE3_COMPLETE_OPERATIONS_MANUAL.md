# Phase 3 완전 운영 매뉴얼: ExecutionLog 모니터링 자동화

**작성일**: 2026-05-19  
**대상**: CRM 운영팀 / 개발팀  
**용도**: 일일/주간/월간 자동 모니터링 실행 및 점검

---

## 목차
1. [일일 자동 점검](#1-일일-자동-점검-자동화됨)
2. [주간 점검](#2-주간-점검-운영팀)
3. [월간 점검](#3-월간-점검-전체-팀)
4. [비상 대응](#4-비상-대응-긴급)
5. [성능 기준표](#5-성능-기준표)
6. [대시보드 설정](#6-대시보드-설정)
7. [검증 로직 개요](#7-검증-로직-개요)

---

## 1. 일일 자동 점검 (자동화됨)

### 1.1 자동 실행 일정

```yaml
크론잡 이름: cronVerifyExecutionLog
실행 시간: 매일 06:00 KST (UTC+9)
알림 시간: 매일 07:00 KST
담당팀: 자동 (Vercel Cron)
```

### 1.2 자동 검증 항목 (4가지)

#### ✅ 검증 항목 1: 행 수 일관성

**목표**: ExecutionLog와 SendingHistory 행 수 비율 ≥ 95%

```sql
-- 검증 데이터
SELECT
  COUNT(*) as executionLogCount
FROM execution_log
WHERE created_at > NOW() - INTERVAL '7 days'
  AND source_type = 'CAMPAIGN';

SELECT
  COUNT(*) as sendingHistoryCount
FROM sending_history
WHERE created_at > NOW() - INTERVAL '7 days'
  AND campaign_id IS NOT NULL;

-- 계산식
consistency = MIN(
  (executionLogCount / sendingHistoryCount) * 100,
  (sendingHistoryCount / executionLogCount) * 100
)
```

**판정 기준**:
- ✅ PASS: consistency ≥ 95%
- 🟡 WARN: 90% ≤ consistency < 95%
- 🔴 FAIL: consistency < 90% → **자동 롤백**

---

#### ✅ 검증 항목 2: 채널별 동기화율

**목표**: SMS/Email 분포 비율 일치도 ≥ 99%

```typescript
// SendingHistory 채널별 비율
const sendingRatio = {
  SMS: (smsSendingCount / totalSendingCount) * 100,
  EMAIL: (emailSendingCount / totalSendingCount) * 100
};

// ExecutionLog 채널별 비율
const executionRatio = {
  SMS: (smsExecutionCount / totalExecutionCount) * 100,
  EMAIL: (emailExecutionCount / totalExecutionCount) * 100
};

// 동기화율 계산
let totalDiff = 0;
for (const channel of ["SMS", "EMAIL"]) {
  const diff = Math.abs(
    (sendingRatio[channel] || 0) - (executionRatio[channel] || 0)
  );
  totalDiff += diff;
}
const syncRate = 100 - (totalDiff / channels.length);
```

**판정 기준**:
- ✅ PASS: syncRate ≥ 99%
- 🟡 WARN: 95% ≤ syncRate < 99%
- 🔴 FAIL: syncRate < 95% → 경고

---

#### ✅ 검증 항목 3: CAMPAIGN 필터 정확도

**목표**: sourceType='CAMPAIGN'인 ExecutionLog는 반드시 campaignId NOT NULL

```sql
-- 불일치 데이터 확인
SELECT COUNT(*) as mismatchCount
FROM execution_log
WHERE source_type = 'CAMPAIGN'
  AND campaign_id IS NULL
  AND created_at > NOW() - INTERVAL '7 days';
```

**판정 기준**:
- ✅ PASS: mismatchCount = 0
- 🟡 WARN: 0 < mismatchCount ≤ 10 (0.01% 이상)
- 🔴 FAIL: mismatchCount > 10 → 경고

---

#### ✅ 검증 항목 4: 타임스탐프 오차 (P99)

**목표**: ExecutionLog와 SendingHistory의 타임스탬프 차이 < 5초 (P99)

```typescript
// 최근 500개 샘플로 P99 계산
const diffs = pairs
  .filter(p => p.executionLog)
  .map(p => Math.abs(
    p.createdAt.getTime() - p.executionLog!.createdAt.getTime()
  ) / 1000)  // 초 단위
  .sort((a, b) => a - b);

const p99Index = Math.ceil(diffs.length * 0.99) - 1;
const p99Value = diffs[p99Index];
```

**판정 기준**:
- ✅ PASS: p99Value < 5초
- 🟡 WARN: 5초 ≤ p99Value < 10초
- 🔴 FAIL: p99Value ≥ 10초 → 경고

---

### 1.3 일일 알림 해석 (Slack #crm-ops)

#### 정상 알림 예시 (✅ 녹색)

```
[DAILY_VERIFICATION] 2026-05-19 일일 검증 완료 - ✅ 정상

📊 행수 일관성: 98.5% (PASS ✅)
  ├─ SendingHistory: 15,234개
  └─ ExecutionLog: 15,020개

📡 채널별 동기화율: 99.8% (PASS ✅)
  ├─ SendingHistory: SMS 68%, Email 32%
  └─ ExecutionLog: SMS 68%, Email 32%

🎯 CAMPAIGN 필터 정확도: 100% (PASS ✅)
  ├─ 총 캠페인: 15,020개
  └─ 불일치: 0개

⏱️ 타임스탬프 오차 (P99): 0.2초 (PASS ✅)
  ├─ 샘플 크기: 500개
  ├─ 최대 오차: 1.5초
  └─ 평균 오차: 0.1초

검증 시간: 45초
마지막 검증: 2026-05-19 06:00:30 KST
다음 검증: 2026-05-20 06:00:00 KST
```

**조치**: 없음 (정상 운영)

---

#### 경고 알림 예시 (🟡 주황색)

```
[DAILY_VERIFICATION] 2026-05-19 일일 검증 완료 - ⚠️ 경고

📊 행수 일관성: 96.2% (PASS ✅)
  ├─ SendingHistory: 15,234개
  └─ ExecutionLog: 14,651개

📡 채널별 동기화율: 97.5% (⚠️ WARN)
  ├─ SendingHistory: SMS 68%, Email 32%
  ├─ ExecutionLog: SMS 70%, Email 30%
  └─ 원인: SMS 누적 발송으로 인한 불균형

🎯 CAMPAIGN 필터 정확도: 99.8% (⚠️ WARN)
  ├─ 총 캠페인: 15,020개
  ├─ 불일치: 35개
  └─ 원인: sourceType='CAMPAIGN'이지만 campaignId=NULL인 데이터

⏱️ 타임스탬프 오차 (P99): 4.2초 (PASS ✅)

검증 시간: 48초
마지막 검증: 2026-05-19 06:00:30 KST
권장 조치: 다음 크론잡 결과 모니터링 (내일 07:00 확인)
```

**조치** (운영팀, 24시간 내):
1. [ ] 다음 크론잡 결과 확인
2. [ ] 일관성 개선 추세 확인
3. [ ] 필요 시 개발팀에 보고

---

#### 긴급 알림 예시 (🚨 빨강색)

```
[CRITICAL_ROLLBACK] 🚨 자동 롤백 진행 중

⚠️ 행수 일관성: 92.1% (🔴 FAIL)
  ├─ SendingHistory: 15,234개
  ├─ ExecutionLog: 14,000개
  ├─ 불일치: 1,234개 (8.1% 오차)
  └─ 임계값: 95% (현재 92.1% < 95%)

🔧 자동 조치 실행됨:
  ├─ Feature Flag `ENABLE_EXECUTION_LOG`: false (비활성화)
  ├─ Redis 캐시 무효화 완료
  ├─ 롤백 이벤트 기록됨
  └─ 현재 모드: SendingHistory만 사용 (Safe Mode)

⏱️ 롤백 완료 시간: 15초

🚨 운영팀 필수 조치 (< 1시간):
  1. Slack #crm-ops 채널 확인
  2. 문제 데이터 분석 (아래 SQL 참고)
  3. 개발팀에 즉시 보고

📋 문제 데이터 확인:
SELECT * FROM execution_log 
WHERE source_type='CAMPAIGN' 
  AND campaign_id IS NULL 
  AND created_at > NOW() - INTERVAL '1 hour'
LIMIT 10;
```

**조치** (운영팀, 즉시):
1. [ ] **5분 이내**: Slack 알림 확인
2. [ ] **30분 이내**: SQL로 불일치 데이터 확인
3. [ ] **1시간 이내**: 개발팀에 보고 (Slack 또는 이메일)
4. [ ] **4시간 이내**: 복구 계획 수립 (다음 "주간 점검" 참고)

---

### 1.4 일일 점검 체크리스트 (운영팀, 매일 07:00)

```
□ 07:00: Slack #crm-ops 알림 수신 확인
  ├─ 정상 알림이면: 아무 조치 없음
  ├─ 경고 알림이면: 메모 남기고 내일 07:00 다시 확인
  └─ 긴급 알림이면: 즉시 개발팀 연락

□ 매주 월요일 09:00: 지난주 알림 정리
  └─ 경고 알림이 3회 이상 발생했으면 주간 리뷰 일정 추가
```

---

## 2. 주간 점검 (운영팀)

### 2.1 주간 점검 일정

```
매주 월요일 09:00 - 09:30 (CRM 운영팀 전체)
담당자: 운영팀장
참석자: CRM 운영팀 + 개발팀 리드
```

### 2.2 주간 점검 지표

#### 지표 1: 일관성 추세 (7일)

```sql
SELECT
  DATE(created_at) as date,
  (COUNT(DISTINCT campaign_id) / 
   (SELECT COUNT(DISTINCT campaign_id) FROM sending_history 
    WHERE created_at > NOW() - INTERVAL '1 day'
    AND source_type = 'CAMPAIGN')
  ) * 100 as consistency_pct
FROM execution_log
WHERE created_at > NOW() - INTERVAL '7 days'
  AND source_type = 'CAMPAIGN'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**목표**: 일관성이 ≥ 95% 유지되거나 상향 추세

---

#### 지표 2: 경고 발생 빈도

```
지난 7일간 Slack 알림 통계:
- 정상 알림: 7회 (목표: 7회)
- 경고 알림: 1회 (목표: 0회)
- 긴급 알림: 0회 (목표: 0회)

분석:
□ 경고 알림이 2회 이상이면 개발팀과 함께 근본 원인 분석
□ 긴급 알림이 1회 이상이면 즉시 근본 원인 분석 (별도 회의)
```

---

#### 지표 3: 롤백 발생 유무

```
지난 7일간 롤백:
- 자동 롤백: 0회 (목표: 0회)
- 수동 롤백: 0회 (목표: 0회)
- 복구 시간 (있었다면): __분 (목표: < 60분)
```

---

#### 지표 4: API 응답 성능

```typescript
// Vercel Analytics 확인 (crm.mabiz.co.kr)
- Campaign 조회 API 평균 응답시간: __ms (목표: < 200ms)
- Webhook 처리 평균 시간: __ms (목표: < 500ms)
- 에러율: __%  (목표: < 0.1%)
```

---

### 2.3 주간 점검 체크리스트

```markdown
## 2026년 5월 19일 (주) 점검

### A. 운영 현황
- [ ] 지난주 알림 7개 모두 정상 알림 확인
- [ ] 경고/긴급 알림 없음 확인
- [ ] 롤백 발생 없음 확인
- [ ] 성능 지표 정상 (모두 < 목표값)

### B. 데이터 품질
- [ ] ExecutionLog vs SendingHistory 일관성 ≥ 95%
- [ ] CAMPAIGN 필터 정확도 100% 또는 < 0.1% 오차
- [ ] 타임스탬프 P99 < 5초

### C. 인프라 상태
- [ ] Redis 연결 정상 (캐시 히트율 > 95%)
- [ ] DB 연결 풀 가용성 정상 (대기 쿼리 없음)
- [ ] Slack Webhook 정상 (알림 지연 < 1분)

### D. 다음주 계획
- [ ] 조치 필요사항: __________
- [ ] 개발팀 협의: __________
- [ ] 팀 공지: __________

### 체크인
- 점검자: __________ 
- 점검일: 2026-05-20
- 서명: __________
```

---

## 3. 월간 점검 (전체 팀)

### 3.1 월간 점검 일정

```
매월 첫째 주 목요일 10:00 - 11:00 (CRM 전체 팀)
담당자: CRM 팀장
참석자: CRM팀 + 개발팀 + 데이터팀
```

---

### 3.2 월간 점검 항목 (7가지 필수)

#### P1: ExecutionLog vs SendingHistory 일관성 (99% 이상)

```sql
SELECT
  COUNT(*) as total_execution_logs,
  (SELECT COUNT(*) FROM sending_history 
   WHERE campaign_id IS NOT NULL 
   AND created_at > NOW() - INTERVAL '30 days') as total_sending_history,
  ROUND(
    100.0 * COUNT(*) / 
    (SELECT COUNT(*) FROM sending_history 
     WHERE campaign_id IS NOT NULL 
     AND created_at > NOW() - INTERVAL '30 days'),
    2
  ) as consistency_pct
FROM execution_log
WHERE source_type = 'CAMPAIGN'
  AND created_at > NOW() - INTERVAL '30 days';

결과: consistency_pct = ___%  (목표: ≥ 99%)
```

**판정**:
- ✅ PASS: consistency_pct ≥ 99%
- 🟡 WARN: 95% ≤ consistency_pct < 99%
- 🔴 FAIL: consistency_pct < 95%

---

#### P2: Enum Fallback 감소 추이

```typescript
// ExecutionStatus ENUM Fallback 발생 건수
const fallbackCount = await db.executionLog.count({
  where: {
    status: "FALLBACK",  // 또는 기본값으로 설정된 경우
    createdAt: {
      gte: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000)
    }
  }
});

결과: fallbackCount = ___ 건 (목표: 0건)
추이: 이전달 대비 ___%
```

**판정**:
- ✅ PASS: fallbackCount = 0
- 🟡 WARN: 1 ≤ fallbackCount ≤ 10
- 🔴 FAIL: fallbackCount > 10

---

#### P3: 자동 복구 성공률 (100% 목표)

```typescript
// 지난 30일 복구 이벤트
const recoveryEvents = await db.rollbackEvent.findMany({
  where: {
    createdAt: {
      gte: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000)
    }
  }
});

const successCount = recoveryEvents.filter(e => e.status === "SUCCESS").length;
const successRate = (successCount / recoveryEvents.length) * 100;

결과: successRate = ___%  (목표: 100%)
롤백 발생 건수: ___ 회
```

**판정**:
- ✅ PASS: successRate = 100% (또는 롤백 0회)
- 🟡 WARN: 90% ≤ successRate < 100%
- 🔴 FAIL: successRate < 90%

---

#### P4: 모니터링 지표 대시보드 가동 확인

```bash
# 대시보드 엔드포인트 확인
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  https://crm.mabiz.co.kr/api/admin/verification/status

응답 예시:
{
  "timestamp": "2026-05-19T10:00:00Z",
  "isHealthy": true,
  "consistency": 98.5,
  "channelSyncRate": 99.8,
  "timestampP99": 0.2,
  "rollbackTriggered": false,
  "lastVerificationAt": "2026-05-19T06:00:30Z"
}
```

**판정**:
- ✅ PASS: 모든 필드 정상 + HTTP 200
- 🔴 FAIL: HTTP 4xx/5xx 또는 응답 없음

---

#### P5: 롤백 발생 근본 원인 분석

```markdown
## 지난 30일 롤백 분석

### 롤백 발생 이력
- 발생 건수: ___ 회
- 자동 롤백: ___ 회
- 수동 롤백: ___ 회

### 각 건별 원인 분석
1. 2026-05-15 06:00 롤백
   - 일관성: 92.1%
   - 원인: __________
   - 해결: __________
   - 소요 시간: __분

2. ...

### 종합 분석
- 주요 원인: __________
- 재발 가능성: High/Medium/Low
- 예방 조치: __________
```

**판정**:
- ✅ PASS: 롤백 0회
- 🟡 WARN: 1-2회 (원인 분석 완료)
- 🔴 FAIL: 3회 이상 또는 원인 미파악

---

#### P6: Rate Limit 정책 효과 검증

```sql
-- API 호출 분포 (지난 30일)
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as api_call_count,
  COUNT(CASE WHEN status >= 429 THEN 1 END) as rate_limit_hits
FROM api_logs
WHERE api_name IN ('campaign-list', 'campaign-detail', 'execution-log-get')
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;

결과:
- 총 API 호출: ___ 건
- Rate Limit 발생: ___ 건 (목표: < 1%)
- 비율: ___%
```

**판정**:
- ✅ PASS: Rate Limit 비율 < 1%
- 🟡 WARN: 1% ≤ 비율 < 5%
- 🔴 FAIL: 비율 ≥ 5%

---

#### P7: 팀 피드백 수집 (운영/개발)

```markdown
## 월간 피드백 (익명 투표)

### 1. 모니터링 알림 품질 (1-5점)
- 관련성 높음: ___점 (목표: > 4점)
- 이해하기 쉬움: ___점
- 시기 적절함: ___점

### 2. 운영 편의성
- 현재 체크리스트가 효과적인가? Yes/No
- 개선 필요사항:
  - __________
  - __________

### 3. 시스템 안정성 신뢰도 (1-5점)
- ExecutionLog 신뢰: ___점
- 롤백 메커니즘 신뢰: ___점
- 전체 시스템: ___점

### 4. 자유 의견
```

**판정**: 피드백 기반 개선 계획 수립

---

### 3.3 월간 점검 최종 보고서 템플릿

```markdown
# 2026년 5월 Phase 3 모니터링 월간 점검 보고서

**작성일**: 2026-05-31  
**작성자**: CRM 팀장  
**점검 기간**: 2026-05-01 ~ 2026-05-31

## 1. 점검 결과 요약

| 항목 | 결과 | 목표 | 상태 |
|------|------|------|------|
| P1: 일관성 (%) | ___% | ≥99% | ✅/🟡/🔴 |
| P2: Fallback (건) | ___ | 0 | ✅/🟡/🔴 |
| P3: 복구율 (%) | __% | 100% | ✅/🟡/🔴 |
| P4: 대시보드 | 가동 | 정상 | ✅/🔴 |
| P5: 롤백 분석 | ___ | 원인분석 | ✅/🟡/🔴 |
| P6: Rate Limit | __% | < 1% | ✅/🟡/🔴 |
| P7: 팀 피드백 | ___점/5 | > 4점 | ✅/🟡 |

**종합 판정**: ✅ 정상 / 🟡 주의 / 🔴 위험

---

## 2. 상세 분석

### 2.1 강점
- __________
- __________

### 2.2 개선 필요 사항
- 우선순위 높음: __________
- 우선순위 중간: __________

### 2.3 다음달 목표
- __________
- __________

---

## 3. 조치 계획

| 조치 항목 | 담당자 | 완료일 |
|----------|--------|--------|
| __________ | ______ | 2026-06-14 |
| __________ | ______ | 2026-06-21 |

---

## 4. 승인

- CRM 팀장 승인: __________ (날짜: __)
- 개발팀 피드백: __________

```

---

## 4. 비상 대응 (긴급)

### 4.1 상황 1: 자동 롤백 발생 시

**증상**: 🚨 긴급 알림 ("CRITICAL_ROLLBACK")

**대응 단계**:

```
1단계 (즉시, < 5분):
  [ ] Slack #crm-ops 알림 확인
  [ ] 롤백 메시지 읽음 (일관성 수치 확인)
  [ ] 개발팀 Slack @dev-oncall 태그

2단계 (< 15분):
  [ ] 데이터 확인 SQL 실행
      ```sql
      SELECT COUNT(*) as mismatch_count
      FROM execution_log
      WHERE source_type='CAMPAIGN' AND campaign_id IS NULL
        AND created_at > NOW() - INTERVAL '1 hour';
      ```
  [ ] 불일치 데이터 샘플 확인
      ```sql
      SELECT * FROM execution_log
      WHERE source_type='CAMPAIGN' AND campaign_id IS NULL
      LIMIT 5;
      ```

3단계 (< 30분):
  [ ] 문제 규모 파악 (행 수, 시간 범위)
  [ ] #crm-ops 채널에 정리된 요약 게시
  [ ] 개발팀과 함께 근본 원인 논의

4단계 (1-4시간):
  [ ] 데이터 검증 완료 후 복구 허가
  [ ] 복구 API 호출 (개발팀)
  [ ] 시스템 모니터링 (다음 크론잡까지)
```

---

### 4.2 상황 2: 검증 크론잡 실패 시

**증상**: 06:00에 알림이 오지 않음, 또는 오류 메시지

**대응 단계**:

```
1단계 (07:00에 알림 없으면 즉시):
  [ ] Slack #crm-errors 채널 확인
  [ ] Sentry 로그 확인 (dev.mabiz.co.kr/sentry)

2단계 (< 20분):
  [ ] 크론잡 수동 트리거 (개발팀):
      ```bash
      curl -X POST \
        https://crm.mabiz.co.kr/api/cron/verify-execution-log \
        -H "Authorization: Bearer CRON_SECRET"
      ```

3단계 (실패하면):
  [ ] Redis 연결 상태 확인
      - Vercel Dashboard → Storage
      - Redis 가용성 확인
  
  [ ] DB 연결 확인
      - Neon Console → Connection Pool
      - 활성 연결 > 20 확인

4단계 (해결 안 되면):
  [ ] 개발팀 PagerDuty 알림 (자동)
  [ ] 수동 점검으로 대체 (SQL 직접 실행)
```

---

### 4.3 상황 3: Slack 알림 미전송 시

**증상**: 시간이 지났는데 Slack 알림이 없음

**대응 단계**:

```
1단계 (< 10분):
  [ ] Webhook URL 확인
      SLACK_WEBHOOK_VERIFY가 .env에 있는가?
  
  [ ] Slack 워크스페이스 접근 확인
      - Slack 앱 관리에서 권한 확인
      - 채널 #crm-ops 구독 여부

2단계 (< 20분):
  [ ] 수동으로 대시보드 확인:
      ```bash
      curl -H "Authorization: Bearer ADMIN_TOKEN" \
        https://crm.mabiz.co.kr/api/admin/verification/status
      ```

3단계 (알림은 없지만 검증은 됨):
  [ ] Webhook URL 재설정 필요
  [ ] Slack App Settings → Incoming Webhooks
  [ ] 새 Webhook 생성 후 .env.local 업데이트
  [ ] Vercel 재배포
```

---

## 5. 성능 기준표

### 5.1 검증 프로세스 성능

| 항목 | 기준값 | 경고값 | 위험값 |
|------|--------|--------|---------|
| **검증 실행 시간** | 45초 | > 90초 | > 180초 |
| **롤백 완료 시간** | 15초 | > 30초 | > 60초 |
| **Slack 알림 지연** | 1분 | > 3분 | > 5분 |
| **DB 쿼리 시간** | 100ms/쿼리 | > 200ms | > 500ms |

---

### 5.2 데이터 품질 기준

| 항목 | 목표 | 경고 | 위험 |
|------|------|------|------|
| **행수 일관성** | ≥ 95% | 90-95% | < 90% |
| **채널 동기화** | ≥ 99% | 95-99% | < 95% |
| **타임스탬프 P99** | < 5초 | 5-10초 | > 10초 |
| **Fallback 건수/월** | 0 | 1-10 | > 10 |

---

### 5.3 인프라 기준

| 항목 | 목표 | 경고 | 위험 |
|------|------|------|------|
| **Redis 캐시 히트율** | > 95% | 85-95% | < 85% |
| **DB 연결 풀 대기** | 0건/일 | 1-5건 | > 5건 |
| **API 에러율** | < 0.1% | 0.1-1% | > 1% |
| **Cron 성공률** | 100% | 95-100% | < 95% |

---

## 6. 대시보드 설정

### 6.1 모니터링 API 엔드포인트

#### 현재 검증 상태
```bash
GET /api/admin/verification/status
Authorization: Bearer ADMIN_TOKEN

응답:
{
  "timestamp": "2026-05-19T07:00:00Z",
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

---

#### 롤백 상태
```bash
GET /api/admin/verification/rollback-status
Authorization: Bearer ADMIN_TOKEN

응답:
{
  "isExecutionLogEnabled": true,
  "rollbackState": {
    "isActive": false,
    "triggeredAt": null,
    "reason": null,
    "recoveryTarget": null
  },
  "lastRollbackAt": null,
  "recoveryInProgress": false
}
```

---

#### 검증 이력 (최근 30일)
```bash
GET /api/admin/verification/history?days=30
Authorization: Bearer ADMIN_TOKEN

응답:
[
  {
    "date": "2026-05-19",
    "consistency": 98.5,
    "channelSyncRate": 99.8,
    "passed": true,
    "warnings": []
  },
  ...
]
```

---

### 6.2 Grafana 대시보드 (향후 예정)

**목표**: 다음달 Grafana 연동

```yaml
패널 1: 일관성 추세 (시계열, 30일)
  - X축: 날짜
  - Y축: 일관성율 (%)
  - 임계값: 95% (빨강), 99% (녹색)

패널 2: 롤백 이벤트 (월별)
  - 막대 그래프
  - 자동 롤백 vs 수동 롤백 구분

패널 3: Fallback 건수 (일별)
  - 라인 그래프
  - 목표값 0

패널 4: API 응답시간 (실시간)
  - 히스토그램
  - P50, P95, P99 표시
```

---

## 7. 검증 로직 개요

### 7.1 완전한 검증 흐름도

```
시작 (매일 06:00)
    ↓
[1] 행수 일관성 검증
    ├─ ExecutionLog COUNT (최근 7일)
    ├─ SendingHistory COUNT (최근 7일)
    └─ consistency = MIN(exec/send, send/exec) * 100
    
[2] 채널별 동기화 검증
    ├─ SMS/Email 분포율 (SendingHistory)
    ├─ SMS/Email 분포율 (ExecutionLog)
    └─ syncRate = 100 - (합계 차이)

[3] CAMPAIGN 필터 정확도
    ├─ sourceType='CAMPAIGN'이면서 campaignId=NULL 개수
    └─ accuracy = (일치건수 / 총건수) * 100

[4] 타임스탬프 오차 검증
    ├─ 최근 500개 샘플 SELECT
    ├─ 각 쌍의 시간 차이 계산
    └─ P99 값 도출
    
모든 검증 완료
    ↓
결과 종합 (VerificationResult)
    ↓
모두 PASS? 
  ├─ YES → Slack ✅ 알림 + 다음날 대기
  ├─ WARN → Slack ⚠️ 알림 + 모니터링
  └─ FAIL → 자동 롤백 트리거
              ├─ Feature Flag OFF
              ├─ Redis 캐시 무효화
              ├─ 롤백 이벤트 기록
              └─ Slack 🚨 알림
```

---

### 7.2 주요 쿼리 (SQL)

#### 일관성 검증
```sql
-- ExecutionLog 행수
SELECT COUNT(*) as exec_count
FROM execution_log
WHERE source_type = 'CAMPAIGN'
  AND created_at > NOW() - INTERVAL '7 days';

-- SendingHistory 행수
SELECT COUNT(*) as send_count
FROM sending_history
WHERE campaign_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days';
```

#### 채널 동기화 검증
```sql
-- SendingHistory 채널 분포
SELECT
  channel,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as pct
FROM sending_history
WHERE campaign_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY channel;

-- ExecutionLog 채널 분포 (동일)
SELECT
  channel,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as pct
FROM execution_log
WHERE source_type = 'CAMPAIGN'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY channel;
```

---

## 정리

이 매뉴얼은 **Phase 3 모니터링 자동화**를 24/7 운영하기 위한 완전한 가이드입니다:

- ✅ **일일**: 자동 검증 + Slack 알림
- ✅ **주간**: 운영팀 7개 지표 검토
- ✅ **월간**: 전체팀 7개 항목 평가
- ✅ **긴급**: 3가지 상황별 대응 절차
- ✅ **기준표**: 성능 임계값 정리
- ✅ **API**: 모니터링 엔드포인트 제공

**문의**: CRM 팀장 (Slack #crm-ops)
