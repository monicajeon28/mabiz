# Menu #38 Phase 3-δ: 자동 검증 + 모니터링 (매일 06:00)

## 📋 작업 완료 요약

### 의사결정 확정
✅ 전환 방식: 병행 운영 (1주)
✅ 검증: 자동화 (매일 06:00 크론잡)
✅ 롤백: 즉시 롤백 (< 1분, 자동 복구)

---

## 🎯 Step 별 산출물

### Step 1: 자동 검증 크론잡 설계
**파일**: `src/lib/cron/verify-execution-log.ts`

- 4가지 검증 항목 구현 (병렬 실행):
  1. **행 수 일관성**: `executionCount / sendingCount ≥ 95%`
  2. **채널별 동기화**: SMS/Email 분포 동기화율 ≥ 99%
  3. **CAMPAIGN 필터**: sourceType='CAMPAIGN' 정확도 = 100%
  4. **타임스탬프 오차**: P99 < 5초

- 핵심 함수:
  - `verifyExecutionLogConsistency()` - 메인 검증 로직
  - `cronVerifyExecutionLog()` - Cron 진입점 (매일 06:00)
  - 각 검증별 독립 함수

- 검증 데이터 범위:
  - 시간 윈도우: 최근 7일 (롤링)
  - 샘플: 타임스탬프는 최근 1000개
  - 필터: `sourceType='CAMPAIGN'` 또는 `campaignId IS NOT NULL`

---

### Step 2: 모니터링 로직 구현 & 롤백 자동화
**파일**: `src/lib/services/rollback-handler.ts`

- 자동 롤백 트리거:
  - 일관성 < 95% → 즉시 롤백
  - 롤백 완료 시간: < 1분

- 핵심 함수:
  - `isExecutionLogEnabled()` - Feature Flag 확인 (Redis)
  - `rollbackToSendingHistory()` - 메인 롤백 로직
  - `disableExecutionLogFeature()` - Feature Flag 비활성화
  - `invalidateExecutionLogCache()` - 캐시 무효화
  - `recordRollbackEvent()` - 롤백 이벤트 기록
  - `validateSendingHistoryIntegrity()` - 정합성 검증
  - `enableExecutionLogFeature()` - Feature Flag 재활성화 (수동 복구)

- Feature Flag:
  - **ENABLE_EXECUTION_LOG**: true/false (Redis 저장, 환경변수 기본값)
  - 롤백 시 자동 false로 설정
  - 복구 시 수동으로 true로 복구

---

### Step 3: Slack Alert 연동
**파일**: `src/lib/services/slack-notifier.ts`

- 알림 타입 5가지:
  1. **DAILY_VERIFICATION** (매일 07:00) - 정상/경고
  2. **CRITICAL_ROLLBACK** (즉시) - 자동 롤백
  3. **ERROR_ROLLBACK** (즉시) - 오류로 인한 롤백
  4. **RECOVERY_STARTED** (수동) - 복구 시작
  5. **RECOVERY_COMPLETED** (수동) - 복구 완료

- 핵심 함수:
  - `notifySlack()` - 통합 알림 인터페이스
  - `notifyDailyVerification()` - 일일 검증 결과
  - `notifyCriticalRollback()` - 긴급 롤백 알림
  - `getRecoveryGuide()` - 운영팀 복구 가이드

- Webhook 구성:
  - **환경변수**: SLACK_WEBHOOK_VERIFY
  - **채널**: #crm-ops (추천)
  - **색상 코드**:
    - 🟢 정상 (DAILY_VERIFICATION)
    - 🔴 긴급 (CRITICAL_ROLLBACK)
    - 🟠 경고 (ERROR_ROLLBACK)
    - 🔵 진행 중 (RECOVERY_*)

---

### Step 4: 타입 정의
**파일**:
- `src/types/verification.ts` - 검증 관련 타입
- `src/types/rollback.ts` - 롤백 관련 타입
- `src/types/notification.ts` - Slack 알림 타입

---

### Step 5: Feature Flag 미들웨어 & API
**파일**:
- `src/lib/middleware/feature-flag-middleware.ts` - Feature Flag 확인
- `src/app/api/admin/verification/status/route.ts` - 상태 조회
- `src/app/api/admin/verification/rollback/route.ts` - 수동 롤백
- `src/app/api/admin/verification/recovery/route.ts` - 복구 실행

**API 엔드포인트**:
```bash
# 상태 조회
GET /api/admin/verification/status

# 수동 롤백 (관리자용)
POST /api/admin/verification/rollback

# 복구 실행 (데이터 검증 후)
POST /api/admin/verification/recovery
```

---

### Step 6: 환경변수 설정
**파일**: `.env.local`

```env
# Phase 3-δ: 자동 검증 + 모니터링 (매일 06:00)
# Slack 웹훅: ExecutionLog 검증 결과 및 롤백 알림
SLACK_WEBHOOK_VERIFY="https://hooks.slack.com/services/YOUR_WORKSPACE/YOUR_CHANNEL/YOUR_TOKEN"

# ExecutionLog 활성화 여부 (Feature Flag)
# true: ExecutionLog 사용, false: SendingHistory 안전 모드
ENABLE_EXECUTION_LOG="true"
```

---

### Step 7: 운영 가이드 문서
**파일**: `docs/PHASE3_MONITORING_OPERATIONS.md`

- 자동 검증 일정 (매일 06:00)
- Slack 알림 해석 가이드 (정상/경고/긴급/복구)
- 롤백 절차 (자동/수동)
- 복구 절차 (3단계)
- Slack Webhook 설정 방법
- 주요 메트릭 대시보드
- 비상 연락처
- FAQ & 트러블슈팅
- 성능 특성
- 월간 점검 체크리스트

---

## 🔍 데이터 흐름 다이어그램

```
매일 06:00
    ↓
┌─────────────────────────────┐
│ cronVerifyExecutionLog()     │
│ (verify-execution-log.ts)   │
└────────────┬────────────────┘
             ↓
┌─────────────────────────────┐
│ 4가지 검증 병렬 실행          │
│ 1. 행 수 일관성 (≥95%)       │
│ 2. 채널별 동기화 (≥99%)     │
│ 3. CAMPAIGN 필터 (=100%)    │
│ 4. 타임스탬프 오차 (<5초)    │
└────────────┬────────────────┘
             ↓
        모든 검증 통과?
       /             \
      YES (정상)      NO (일관성<95%)
       ↓              ↓
   ┌────────┐  ┌──────────────────────┐
   │매일     │  │rollbackToSendingHistory()
   │07:00   │  │• Feature Flag → false
   │Slack   │  │• 캐시 무효화
   │알림    │  │• 상태 저장
   │(정상) │  │• 롤백 이벤트 기록
   └────────┘  │• 정합성 검증
              └──────┬──────────────────┘
                     ↓
              ┌──────────────────┐
              │Slack 긴급 알림   │
              │(🚨 롤백 완료)   │
              └──────┬───────────┘
                     ↓
        운영팀 수동 개입 (데이터 검증)
                     ↓
      ┌──────────────────────────┐
      │enableExecutionLogFeature()│
      │clearRollbackState()      │
      │(복구 API 호출)           │
      └──────┬───────────────────┘
             ↓
        다음 크론잡부터 ExecutionLog 사용 재개
```

---

## ✅ 검증 항목 상세

### 1. 행 수 일관성

```sql
SELECT
  COUNT(*) as sending_count
FROM SendingHistory
WHERE campaignId IS NOT NULL
  AND createdAt > NOW() - INTERVAL '7 days';

SELECT
  COUNT(*) as execution_count
FROM ExecutionLog
WHERE sourceType = 'CAMPAIGN'
  AND createdAt > NOW() - INTERVAL '7 days';

-- 일관성 = execution_count / sending_count * 100
-- 임계값: ≥ 95% (미만 시 롤백)
```

### 2. 채널별 동기화

```sql
-- SendingHistory 채널별 분포
SELECT channel, COUNT(*) as count
FROM SendingHistory
WHERE campaignId IS NOT NULL
GROUP BY channel;

-- ExecutionLog 채널별 분포
SELECT channel, COUNT(*) as count
FROM ExecutionLog
WHERE sourceType = 'CAMPAIGN'
GROUP BY channel;

-- 비율 계산 후 차이 ≤ 1% 확인
-- 임계값: 동기화율 ≥ 99%
```

### 3. CAMPAIGN 필터 검증

```sql
-- sourceType='CAMPAIGN'이지만 campaignId=NULL인 경우
SELECT COUNT(*) as mismatches
FROM ExecutionLog
WHERE sourceType = 'CAMPAIGN'
  AND campaignId IS NULL;

-- 정확도 = (total - mismatches) / total * 100
-- 임계값: = 100% (1개도 불일치 시 경고)
```

### 4. 타임스탬프 오차

```sql
-- 같은 campaignId, 같은 contactId인 쌍 비교 (샘플링)
SELECT
  sh.createdAt as sending_at,
  el.createdAt as execution_at,
  EXTRACT(EPOCH FROM ABS(sh.createdAt - el.createdAt)) as diff_seconds
FROM SendingHistory sh
JOIN ExecutionLog el 
  ON sh.campaignId = el.campaignId 
  AND sh.contactId = el.contactId
WHERE sh.campaignId IS NOT NULL
  AND sh.createdAt > NOW() - INTERVAL '1 day'
ORDER BY diff_seconds DESC
LIMIT 1000;

-- PERCENTILE_CONT(0.99) 계산
-- 임계값: P99 < 5초
```

---

## 🚨 롤백 절차 (요약)

### 자동 롤백 (일관성 < 95%)
1. Feature Flag `ENABLE_EXECUTION_LOG` → false (Redis, 즉시)
2. ExecutionLog 관련 캐시 삭제
3. 롤백 이벤트 기록
4. Slack 긴급 알림
5. **시스템 자동 전환: SendingHistory만 사용**

**소요 시간**: < 1분

### 수동 복구 (검증 후)
1. **SQL로 데이터 검증** (정합성 확인)
2. **오류 원인 파악** (로그 분석)
3. **복구 API 호출**
   ```bash
   POST /api/admin/verification/recovery
   {
     "action": "enable_execution_log",
     "verificationStatus": "passed"
   }
   ```
4. Feature Flag `ENABLE_EXECUTION_LOG` → true
5. 롤백 상태 초기화
6. Vercel 자동 재배포
7. 다음 크론잡부터 ExecutionLog 사용 재개

---

## 📊 성능 특성

| 항목 | 목표 | 예상 성능 |
|------|------|---------|
| 검증 실행 시간 | < 2분 | ~45초 |
| 롤백 완료 시간 | < 1분 | ~15초 |
| Slack 알림 지연 | < 5분 | ~1분 |
| DB 쿼리 부하 | 가벼움 | < 100ms (각 쿼리) |

---

## 📝 구현 체크리스트

### 개발 완료
- [x] verify-execution-log.ts (4가지 검증)
- [x] rollback-handler.ts (롤백 로직)
- [x] slack-notifier.ts (Slack 알림)
- [x] Feature Flag 미들웨어
- [x] 3개 관리자 API 엔드포인트
- [x] 타입 정의 (3개 파일)
- [x] 운영 가이드 문서
- [x] 환경변수 추가 (.env.local)

### 배포 전 체크
- [ ] Slack Webhook URL 등록 (.env.local SLACK_WEBHOOK_VERIFY)
- [ ] 로컬 테스트 (검증 로직)
- [ ] 스테이징 테스트 (전체 플로우)
- [ ] 데이터베이스 마이그레이션 검증
- [ ] 롤백 시뮬레이션 테스트

### 배포 후 체크 (운영팀)
- [ ] Slack #crm-ops 채널 구독
- [ ] 첫 크론잡 실행 확인 (다음날 06:00)
- [ ] 알림 수신 확인 (07:00)
- [ ] 대시보드 링크 북마크
- [ ] 비상 연락처 숙지

---

## 🔗 관련 파일 목록

### 핵심 로직
```
src/lib/cron/verify-execution-log.ts          - 검증 크론잡
src/lib/services/rollback-handler.ts          - 롤백 핸들러
src/lib/services/slack-notifier.ts            - Slack 알림
src/lib/middleware/feature-flag-middleware.ts - Feature Flag
```

### API 엔드포인트
```
src/app/api/admin/verification/status/route.ts   - 상태 조회
src/app/api/admin/verification/rollback/route.ts - 수동 롤백
src/app/api/admin/verification/recovery/route.ts - 복구 실행
```

### 타입 정의
```
src/types/verification.ts - 검증 타입
src/types/rollback.ts     - 롤백 타입
src/types/notification.ts - Slack 타입
```

### 문서
```
docs/PHASE3_MONITORING_OPERATIONS.md - 운영 가이드
src/lib/cron/README.md               - Cron 파일 구조 (업데이트)
```

---

## 📞 다음 단계

### Phase 3 최종 단계
1. **테스트** (로컬/스테이징)
2. **배포** (Vercel)
3. **모니터링** (첫 주일)
4. **최적화** (필요시)

### Phase 4 예정 (향후)
- [ ] AI 기반 이상 탐지
- [ ] 자동 데이터 수정
- [ ] 실시간 모니터링 (크론 → 이벤트 기반)
- [ ] Grafana/Datadog 대시보드

---

## 💡 주요 특징

### ✨ 안전성
- **< 1분 롤백**: 문제 발생 시 즉시 안전 모드 전환
- **SendingHistory 보존**: 핵심 데이터 손실 없음
- **정합성 검증**: 롤백 전후 데이터 검증

### ⚡ 성능
- **병렬 검증**: 4가지 항목 동시 실행
- **샘플링 기반**: 전체 데이터 검사가 아닌 효율적 검증
- **가벼운 쿼리**: 각 검증 < 100ms

### 📡 운영성
- **자동 알림**: Slack 일일/긴급 통보
- **자동화 복구**: < 1분 롤백
- **운영팀 통제**: 수동 복구 절차 명확
- **상세 문서**: FAQ, 트러블슈팅 포함

---

## 📋 커밋 예정

```bash
# 1차 커밋: Phase 3-δ 핵심 로직
feat(verify): Phase 3-δ 자동 검증 + 롤백 (< 1분)

# 상세 내용
- verify-execution-log.ts: 4가지 검증 병렬
- rollback-handler.ts: Feature Flag 기반 즉시 롤백
- slack-notifier.ts: 매일 07:00 알림
- 3개 관리자 API + Feature Flag 미들웨어
- 운영 가이드 문서 (다국어 준비)
```

---

## 📈 성공 지표

| 지표 | 목표 | 측정 방법 |
|------|------|---------|
| 일관성 | ≥ 95% | 매일 검증 결과 |
| 동기화율 | ≥ 99% | 채널별 분포 비교 |
| 필터 정확도 | = 100% | campaignId 매칭 |
| 타임스탐프 오차 | P99 < 5초 | 샘플 분석 |
| 롤백 시간 | < 1분 | 로그 기반 측정 |
| 복구 성공률 | = 100% | 월별 리뷰 |

---

**작성일**: 2026-05-18
**상태**: ✅ 완료 (배포 대기)
**담당**: 개발팀 (Phase 3 리드)
