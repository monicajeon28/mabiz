# Phase 3-δ: 자동 검증 + 모니터링 운영 가이드

## 개요

ExecutionLog ↔ SendingHistory 데이터 일관성을 **24/7 자동 모니터링**하고, 문제 발생 시 **< 1분 내 즉시 롤백**하는 시스템입니다.

- **검증 주기**: 매일 06:00 (한국 시간)
- **알림 시간**: 매일 07:00 (Slack 전송)
- **롤백 트리거**: 일관성 < 95%
- **복구 시간**: < 1분

---

## 1. 자동 검증 일정

### 크론잡 구성

```typescript
// lib/cron/verify-execution-log.ts
- 실행: 매일 06:00 (UTC+9)
- 함수: cronVerifyExecutionLog()
- 결과: Slack 알림 (07:00)
```

### 검증 항목 (4가지)

| 검증 항목 | 값 | 임계값 | 트리거 |
|----------|-----|---------|---------|
| **1. 행 수 일관성** | `executionCount / sendingCount` | 95% 이상 | < 95% 롤백 |
| **2. 채널별 동기화** | SMS/Email 분포 비율 | 99% 이상 | < 99% 경고 |
| **3. CAMPAIGN 필터** | sourceType='CAMPAIGN' 정확도 | 100% | 불일치 경고 |
| **4. 타임스탬프 오차** | P99 기준 createdAt 차이 | < 5초 | > 5초 경고 |

### 검증 데이터 범위

- **시간 윈도우**: 최근 7일 (롤링)
- **샘플 크기**: 타임스탬프 검증은 최근 1000개
- **필터**: `sourceType='CAMPAIGN'` 또는 `campaignId IS NOT NULL`

---

## 2. Slack 알림 해석 가이드

### 2.1 정상 알림 (✅ 녹색)

```
[DAILY_VERIFICATION] 일일 검증 완료 - ✅ 정상

행수 일관성: 98.5% (PASS)
  - SendingHistory: 15,234개
  - ExecutionLog: 15,020개

채널별 동기화율: 99.8% (PASS)
  - SendingHistory: SMS 68%, Email 32%
  - ExecutionLog: SMS 68%, Email 32%

CAMPAIGN 필터 정확도: 100% (PASS)
  - 총 캠페인: 15,020개
  - 불일치: 0개

타임스탬프 오차: P99 = 0.2초 (PASS)
  - 샘플 크기: 856개
  - 최대 오차: 1.5초
  - 평균 오차: 0.1초
```

**의미**: 모든 검증 통과, 정상 운영 중

---

### 2.2 경고 알림 (⚠️ 주황색)

```
[DAILY_VERIFICATION] 일일 검증 완료 - ⚠️ 경고

행수 일관성: 96.2% (PASS)
  - SendingHistory: 15,234개
  - ExecutionLog: 14,651개

채널별 동기화율: 97.5% (경고)
  - SendingHistory: SMS 68%, Email 32%
  - ExecutionLog: SMS 70%, Email 30%
  ** SMS 발송 누적으로 인한 불균형

CAMPAIGN 필터 정확도: 99.8% (경고)
  - 총 캠페인: 15,020개
  - 불일치: 35개
  ** sourceType='CAMPAIGN'이지만 campaignId=NULL

타임스탬프 오차: P99 = 4.2초 (PASS)
```

**의미**: 임계값 도달, 24시간 내 모니터링 필요

**조치**:
1. 다음 크론잡 결과 확인 (다음날 07:00)
2. 일관성 개선 경향 모니터링
3. 필요 시 API 재시작

---

### 2.3 긴급 롤백 알림 (🚨 빨강색)

```
[CRITICAL_ROLLBACK] 자동 롤백 진행 중

행수 일관성: 92.1% (FAIL)
  - SendingHistory: 15,234개
  - ExecutionLog: 14,000개
  - 차이: 1,234개 (8.1% 오차)

ACTION: ExecutionLog Feature Flag 비활성화
TARGET: SendingHistory (Safe mode)
TIMESTAMP: 2026-05-18T06:15:30Z

Feature Flag Status:
  - ENABLE_EXECUTION_LOG: false
  - Cache Invalidated: true
  - Rollback Completed: true
```

**의미**: 자동 롤백 완료, 현재 SendingHistory만 사용 중

**조치** (운영팀):
1. 🔴 **즉시 확인** (< 5분)
   ```sql
   SELECT COUNT(*) FROM ExecutionLog WHERE sourceType='CAMPAIGN' AND campaignId IS NULL;
   ```
2. 📊 **데이터 검증** (< 30분)
   ```sql
   -- ExecutionLog 불일치 확인
   SELECT * FROM ExecutionLog 
   WHERE sourceType='CAMPAIGN' AND campaignId IS NULL 
   LIMIT 10;
   ```
3. 📞 **팀 공지** (< 1시간)
   - Slack #crm-ops 채널에 상황 보고
   - 고객 영향도 평가

---

### 2.4 복구 알림 (🔄 파랑색)

```
[RECOVERY_STARTED] ExecutionLog 복구 시작

데이터 검증: 진행 중
  - 새로운 마이그레이션 스크립트 적용 예정
  - 타임스탬프: 2026-05-18T14:00:00Z

복구 예상 시간: 2-4시간
상태: IN_PROGRESS
```

**의미**: 운영팀이 수동으로 복구 절차 시작

---

## 3. 롤백 절차 (수동 개입 필요시)

### 3.1 즉시 롤백 (자동)

```typescript
// 자동 트리거: 일관성 < 95%
await rollbackToSendingHistory(
  "ExecutionLog inconsistency detected (consistency=92.1%)"
);
```

**동작**:
1. Feature Flag `ENABLE_EXECUTION_LOG` → false (Redis, 즉시)
2. ExecutionLog 관련 캐시 삭제
3. 롤백 이벤트 기록
4. Slack 긴급 알림 전송
5. **시스템은 SendingHistory만 사용하도록 자동 전환**

---

### 3.2 수동 롤백 (API)

```bash
# 필요 시 수동 롤백 트리거
curl -X POST \
  https://crm.mabiz.co.kr/api/admin/verification/rollback \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Manual rollback for data investigation"
  }'
```

---

### 3.3 복구 절차 (검증 후)

**선행 조건**: 데이터 정합성 완벽 검증 완료

```sql
-- Step 1: ExecutionLog 정합성 확인
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN sourceType='CAMPAIGN' AND campaignId IS NULL THEN 1 ELSE 0 END) as mismatches,
  (100 - (SUM(CASE WHEN sourceType='CAMPAIGN' AND campaignId IS NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100))::NUMERIC(5,2) as accuracy
FROM ExecutionLog
WHERE createdAt > NOW() - INTERVAL '7 days';

-- Step 2: SendingHistory 데이터 정합성 확인
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN channel='SMS' AND phone IS NULL THEN 1 ELSE 0 END) as null_phones,
  SUM(CASE WHEN channel='EMAIL' AND email IS NULL THEN 1 ELSE 0 END) as null_emails
FROM SendingHistory
WHERE campaignId IS NOT NULL AND createdAt > NOW() - INTERVAL '7 days';
```

**복구 명령** (데이터 검증 후):

```bash
# Feature Flag 재활성화
curl -X POST \
  https://crm.mabiz.co.kr/api/admin/verification/recovery \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "enable_execution_log",
    "verificationStatus": "passed"
  }'
```

**결과**:
- Feature Flag `ENABLE_EXECUTION_LOG` → true
- Vercel 자동 재배포
- 다음 크론잡부터 ExecutionLog 사용 재개

---

## 4. Slack 알림 설정

### 4.1 Webhook URL 등록

```bash
# .env.local에 추가
SLACK_WEBHOOK_VERIFY="https://hooks.slack.com/services/YOUR_WORKSPACE/YOUR_CHANNEL/YOUR_TOKEN"
```

**Webhook 생성**:
1. Slack 앱 관리 → Incoming Webhooks
2. "Add New Webhook to Workspace" 클릭
3. 채널 선택 (#crm-ops 추천)
4. URL 복사 → .env.local 등록

### 4.2 알림 구독 채널

| 채널 | 알림 타입 | 빈도 |
|------|----------|------|
| #crm-ops | 모든 알림 | 매일 |
| @on-call | 긴급 (🚨) | 필요시 |

---

## 5. 주요 메트릭 대시보드

### 5.1 일일 검증 결과

```typescript
// GET /api/admin/verification/status
{
  timestamp: "2026-05-18T07:00:00Z",
  isHealthy: true,
  consistency: 98.5,
  channelSyncRate: 99.8,
  timestampP99: 0.2,
  rollbackTriggered: false,
  lastVerificationAt: "2026-05-18T06:00:30Z"
}
```

### 5.2 롤백 상태

```typescript
// GET /api/admin/verification/rollback-status
{
  isExecutionLogEnabled: false,  // 현재 롤백 중
  rollbackState: {
    triggeredAt: "2026-05-18T06:15:30Z",
    reason: "ExecutionLog inconsistency < 95%",
    recoveryTarget: "SENDING_HISTORY"
  },
  recoveryInProgress: true
}
```

---

## 6. 비상 연락처

### 개발팀
- **Slack**: @dev-team
- **Email**: dev@mabiz.co.kr
- **긴급 연락처**: 010-XXXX-XXXX (개발팀장)

### 데이터팀
- **Slack**: @data-team
- **Email**: data@mabiz.co.kr
- **긴급 DB 접근**: Neon Console

### 온콜 (On-Call)
- **Slack**: @oncall
- **PagerDuty**: /pagerduty-oncall

---

## 7. FAQ & 트러블슈팅

### Q1: 롤백 후 데이터가 손실되지 않을까요?

**A**: 아니요. 안전한 설계입니다.
- SendingHistory는 **핵심 테이블**, 메시지 발송 기록 원본
- ExecutionLog는 ExecutionStatus를 추가로 저장하는 **보조 테이블**
- 롤백 시 ExecutionLog 사용만 중단, SendingHistory는 유지

---

### Q2: 자동 롤백 후 어떻게 복구하나요?

**A**: 3단계 프로세스:
1. **데이터 검증** (SQL 쿼리)
2. **오류 원인 파악** (로그 분석)
3. **수동 복구 API 호출** (운영팀)

자세한 절차는 [3.3 복구 절차](#33-복구-절차-검증-후) 참조

---

### Q3: 타임스탬프 오차가 5초를 초과하면?

**A**: 경고이지만 자동 롤백 트리거는 아닙니다.
- 원인: 데이터베이스 레플리케이션 지연
- 조치: API 응답 속도 모니터링, 필요시 DB 풀 재조정

---

### Q4: Slack 알림을 놓친 경우?

**A**: 대시보드에서 언제든 확인 가능:
```bash
# 최근 검증 결과 조회
curl https://crm.mabiz.co.kr/api/admin/verification/status \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 전체 검증 이력 (최근 30일)
curl https://crm.mabiz.co.kr/api/admin/verification/history \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

### Q5: 크론잡이 실패하면?

**A**: Sentry 자동 모니터링:
- 실패 로그 → Slack #crm-errors 채널 전송
- 자동 재시도: 3회 (지수 백오프)
- 3회 실패 시 PagerDuty 알림

---

## 8. 성능 특성

| 항목 | 목표 | 실제 |
|------|------|------|
| 검증 실행 시간 | < 2분 | ~45초 |
| 롤백 완료 시간 | < 1분 | ~15초 |
| Slack 알림 지연 | < 5분 | ~1분 |
| DB 쿼리 부하 | 가벼움 | < 100ms (각 쿼리) |

---

## 9. 체크리스트

### 배포 전 (개발팀)

- [ ] Slack Webhook URL 등록 (.env.local)
- [ ] Feature Flag 테스트 (로컬)
- [ ] 롤백 시나리오 테스트 (스테이징)
- [ ] 데이터베이스 마이그레이션 검증

### 배포 후 (운영팀)

- [ ] Slack #crm-ops 채널 구독
- [ ] 첫 크론잡 실행 확인 (06:00)
- [ ] 알림 수신 확인 (07:00)
- [ ] 대시보드 링크 북마크
- [ ] 비상 연락처 숙지

### 월간 점검

- [ ] 검증 정확도 리뷰 (최근 30일)
- [ ] 경고 발생 원인 분석
- [ ] 임계값 재검토
- [ ] 복구 시뮬레이션 (테스트 환경)

---

## 10. 개선 계획

### Phase 4 (예정)
- [ ] AI 기반 이상 탐지 (머신러닝)
- [ ] 자동 데이터 수정 (검증 후)
- [ ] 실시간 모니터링 (크론잡 → 이벤트 기반)
- [ ] 대시보드 시각화 (Grafana/Datadog)
