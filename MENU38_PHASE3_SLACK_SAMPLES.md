# Menu #38 Phase 3-δ: Slack 알림 샘플 메시지

**목적**: 실제 Slack 알림 메시지 형식 예시 및 테스트 시나리오

---

## 1. 정상 일일 검증 알림 (매일 07:00)

### Slack 메시지 (JSON 형식)

```json
{
  "text": "[CRM] ExecutionLog Monitoring - DAILY_VERIFICATION",
  "attachments": [
    {
      "fallback": "일일 검증 완료 - ✅ 정상",
      "color": "#36a64f",
      "title": "[DAILY_VERIFICATION] 일일 검증 완료 - ✅ 정상",
      "text": {
        "timestamp": "2026-05-19T07:00:00Z",
        "duration": "4523ms",
        "results": {
          "행수_일관성": {
            "value": "98.5%",
            "threshold": "95%",
            "status": "PASS",
            "details": {
              "SendingHistory": 5432,
              "ExecutionLog": 5356
            }
          },
          "채널별_동기화율": {
            "value": "99.8%",
            "threshold": "99%",
            "status": "PASS",
            "distribution": {
              "SendingHistory": {
                "SMS": 3200,
                "EMAIL": 2232
              },
              "ExecutionLog": {
                "SMS": 3195,
                "EMAIL": 2161
              }
            }
          },
          "CAMPAIGN_필터_정확도": {
            "value": "100%",
            "threshold": "100%",
            "status": "PASS",
            "details": {
              "totalCampaigns": 5356,
              "mismatches": 0
            }
          },
          "타임스탬프_오차": {
            "p99": "2.345초",
            "threshold": "< 5초",
            "status": "PASS",
            "stats": {
              "샘플크기": 1000,
              "최대오차": "4.823초",
              "평균오차": "0.512초"
            }
          }
        },
        "rollbackTriggered": false
      },
      "ts": 1747737600,
      "footer": "ExecutionLog Verification System"
    }
  ]
}
```

### 시각화 (Slack에서 보이는 형태)

```
[CRM] ExecutionLog Monitoring - DAILY_VERIFICATION

[DAILY_VERIFICATION] 일일 검증 완료 - ✅ 정상

행수_일관성: 98.5% (threshold: 95%) ✅ PASS
  SendingHistory: 5,432
  ExecutionLog: 5,356

채널별_동기화율: 99.8% (threshold: 99%) ✅ PASS
  SendingHistory: SMS=3,200, EMAIL=2,232
  ExecutionLog: SMS=3,195, EMAIL=2,161

CAMPAIGN_필터_정확도: 100% (threshold: 100%) ✅ PASS
  Total Campaigns: 5,356
  Mismatches: 0

타임스탬프_오차: 2.345초 (threshold: < 5초) ✅ PASS
  Sample Size: 1,000
  Max Diff: 4.823초
  Avg Diff: 0.512초

롤백 트리거: 없음
실행 시간: 4523ms
```

---

## 2. 경고: 채널별 동기화 저하 (P1 경고)

### 시나리오
- 채널 동기화율: 98.2% (임계값 99% 미만)
- SMS는 동기화 완벽하지만, EMAIL에서 약간의 불일치 발생

### Slack 메시지

```
[CRM] ExecutionLog Monitoring - DAILY_VERIFICATION

[DAILY_VERIFICATION] 일일 검증 완료 - ⚠️ 경고

행수_일관성: 97.2% (threshold: 95%) ✅ PASS
  SendingHistory: 4,500
  ExecutionLog: 4,372

채널별_동기화율: 98.2% (threshold: 99%) ⚠️ WARN
  SendingHistory: SMS=2,800, EMAIL=1,700
  ExecutionLog: SMS=2,798, EMAIL=1,574
  ⚠️ EMAIL 채널에서 126개 불일치 감지

CAMPAIGN_필터_정확도: 100% (threshold: 100%) ✅ PASS
  Total Campaigns: 4,372
  Mismatches: 0

타임스탬프_오차: 3.456초 (threshold: < 5초) ✅ PASS
  Sample Size: 1,000
  Max Diff: 4.234초
  Avg Diff: 0.678초

🔍 권장 조치:
  1. Email 채널 SendingHistory 126개 수동 검증
  2. 24시간 모니터링 강화
  3. 불일치 원인 분석 (타임스탐프 오차 등)

실행 시간: 4,789ms
```

---

## 3. 긴급: 일관성 < 95% (P0 블로커)

### 시나리오
- 행 수 일관성: 87.3% (임계값 95% 미만)
- 자동 롤백 트리거됨 (Feature Flag 비활성화)

### Slack 메시지

```
[CRM] ExecutionLog Monitoring - CRITICAL_ROLLBACK

[CRITICAL_ROLLBACK] 🚨 ExecutionLog 일관성 오류 감지 (87.3%). 즉시 롤백 완료.

상황:
  ❌ 행수 일관성 오류 감지
  SendingHistory: 6,000건
  ExecutionLog: 5,238건
  일관성: 87.3% (임계값: 95%)

자동 롤백 진행 중:
  ✅ Feature Flag 비활성화 (ENABLE_EXECUTION_LOG=false)
  ✅ 캐시 무효화 (ExecutionLog 관련)
  ✅ 롤백 상태 저장
  ✅ SendingHistory 정합성 검증 완료
    - 총 레코드: 6,000
    - null phone (SMS): 0
    - null email (EMAIL): 0
    - 상태: 정상

롤백 완료:
  - 실행 시간: 834ms
  - 현재 시스템: SendingHistory 안전 모드 (완전 구동 중)
  - 메시지 발송: ✅ 정상 (SendingHistory 기반)

🚨 긴급 조치 필요:
  1. 데이터베이스 팀에 즉시 연락
  2. 최근 24시간 ExecutionLog 데이터 검증
  3. 발송 이력 재확인 (SendingHistory vs ExecutionLog 비교)

다음 단계:
  1. 문제 원인 분석 (개발팀)
  2. 데이터 수정 (데이터팀)
  3. 검증 재실행
  4. ExecutionLog Feature Flag 재활성화 (수동)

담당자:
  - 개발팀 Slack: #crm-dev
  - 데이터팀 Slack: #data-eng
  - 온콜: /pagerduty-oncall
```

---

## 4. 오류: 검증 실패 (P0 오류)

### 시나리오
- 검증 중 예상치 못한 오류 발생
- 자동 안전 모드 전환 (SendingHistory만 사용)

### Slack 메시지

```
[CRM] ExecutionLog Monitoring - ERROR_ROLLBACK

[ERROR_ROLLBACK] ⚠️ 검증 중 오류 발생으로 안전 모드 활성화

오류 정보:
  Error: Database connection pool exhausted
  Message: Unable to acquire connection from pool (timeout after 30s)
  Timestamp: 2026-05-19T06:45:23Z

자동 안전 모드 활성화:
  ✅ Feature Flag 비활성화 (ENABLE_EXECUTION_LOG=false)
  ✅ 캐시 무효화
  ✅ 롤백 상태 저장

현재 상태:
  🔴 검증: 실패
  🟢 메시지 발송: 정상 (SendingHistory 기반, 안전 모드)
  🟡 수동 검토 필요: Yes

권장 조치:
  1. 데이터베이스 팀: 연결 풀 상태 확인
     - connection_limit 확인 (현재: 10?)
     - 동시 연결 수 모니터링
  2. 인프라팀: Redis 연결 상태 확인
  3. 개발팀: 로그 분석 (Sentry 확인)

복구 절차:
  1. 문제 원인 해결
  2. 수동 재검증 (SQL 스크립트)
  3. 검증 통과 후 Feature Flag 재활성화

담당자:
  - 데이터베이스팀: #database-ops
  - 인프라팀: #infrastructure
  - 개발팀: #crm-dev
```

---

## 5. 복구 완료 알림 (P0 해결)

### 시나리오
- 이전 롤백 상태에서 문제 해결됨
- ExecutionLog Feature Flag 재활성화 (수동)

### Slack 메시지

```
[CRM] ExecutionLog Monitoring - RECOVERY_COMPLETED

[RECOVERY_COMPLETED] ✅ ExecutionLog 복구 완료

복구 완료 정보:
  ✅ 복구 시작 시각: 2026-05-19T06:00:00Z
  ✅ 복구 완료 시각: 2026-05-19T07:45:00Z
  ✅ 롤백 지속 시간: 1시간 45분

실행한 복구 작업:
  1. ✅ SendingHistory 정합성 검증 통과 (null check 완료)
  2. ✅ ExecutionLog 데이터 수정 (762개 레코드 동기화)
  3. ✅ 검증 스크립트 재실행 (모든 항목 PASS)
     - 행 수 일관성: 99.2% (threshold: 95%)
     - 채널별 동기화: 99.9% (threshold: 99%)
     - CAMPAIGN 필터: 100% (threshold: 100%)
     - 타임스탐프 오차: 1.234초 (threshold: 5초)

Feature Flag 변경:
  - 이전: ENABLE_EXECUTION_LOG=false (안전 모드)
  - 현재: ENABLE_EXECUTION_LOG=true (정상 모드)

시스템 상태:
  🟢 메시지 발송: ExecutionLog 기반 (정상)
  🟢 검증: 정상
  🟢 모니터링: 활성화
  🟢 롤백 상태: 초기화

복구 승인자:
  - 승인 시각: 2026-05-19T07:45:00Z
  - 승인자: hyeseon28@gmail.com (CRM 관리자)
  - 승인 메모: "Database connection pool 증설 완료, ExecutionLog 재활성화"

다음 단계:
  1. 월간 점검 (모니터링 강화)
  2. 데이터베이스 연결 풀 설정 검토 (connection_limit 확인)
  3. 자동화 검증 스케줄 유지

모니터링:
  - 다음 검증: 2026-05-20T06:00:00Z (매일 자동)
  - 수동 모니터링: 7일간 강화
```

---

## 6. 복구 시작 알림 (P0 진행 중)

### 시나리오
- 롤백 후 엔지니어가 문제 해결 시작
- 복구 진행 상황 공유

### Slack 메시지

```
[CRM] ExecutionLog Monitoring - RECOVERY_STARTED

[RECOVERY_STARTED] 🔄 ExecutionLog 복구 시작

롤백 이력:
  - 롤백 시각: 2026-05-19T06:25:00Z
  - 롤백 원인: ExecutionLog 행 수 일관성 오류 (87.3%)
  - 현재 상태: SendingHistory 안전 모드 (메시지 정상 발송)

복구 진행 상황:
  ✅ Step 1: 문제 원인 분석 중...
     - 발견: Database connection pool exhaustion
     - 영향: 대량 SELECT 쿼리 대기
  🔄 Step 2: 데이터 검증 중...
     - SendingHistory 정합성 검증 진행 중
     - 예상 완료: 30분 내
  ⏳ Step 3: ExecutionLog 데이터 수정 (대기)
  ⏳ Step 4: Feature Flag 재활성화 (대기)

진행률: 25% (1/4 단계)

담당자:
  - 개발 리드: @engineer-1
  - 데이터 엔지니어: @data-eng-1
  - SRE: @sre-oncall

예상 복구 완료 시간:
  - 낙관: 30분 내
  - 현실적: 1시간 내
  - 최악: 2시간 내

실시간 업데이트:
  - 진행 상황은 이 메시지에 스레드로 업데이트됩니다
  - Slack 채널 구독: #crm-monitoring
  - 긴급: @channel (별도 공지)
```

---

## 7. 테스트 시나리오별 Slack 메시지 검증

### 테스트 체크리스트

```
□ 테스트 1: 정상 일일 검증 알림
  - 조건: 모든 검증 항목 PASS
  - 예상: 초록색(#36a64f) 알림, "✅ 정상"
  - 검증: 
    ✅ 색상 정확
    ✅ 모든 메트릭 표시
    ✅ timestamp ISO 8601 형식
    ✅ duration 값 정상

□ 테스트 2: 경고 알림 (채널 동기화 < 99%)
  - 조건: channelDistribution.passed = false
  - 예상: 초록색이지만 ⚠️ 표시
  - 검증:
    ✅ 경고 메시지 포함
    ✅ 문제 채널 명시
    ✅ 권장 조치 제시

□ 테스트 3: 긴급 롤백 알림 (일관성 < 95%)
  - 조건: rowConsistency.passed = false
  - 예상: 빨강색(#ff0000), "🚨" 아이콘
  - 검증:
    ✅ 빨강색 정확
    ✅ 자동 롤백 완료 표시
    ✅ 롤백 시간 < 1분
    ✅ 긴급 연락처 포함

□ 테스트 4: 오류 롤백 알림
  - 조건: 검증 중 예외 발생
  - 예상: 주황색(#ff6600), "⚠️" 아이콘
  - 검증:
    ✅ 오류 메시지 상세
    ✅ 안전 모드 활성화 표시
    ✅ 수동 조치 필요 안내

□ 테스트 5: 복구 시작 알림
  - 조건: rollbackState 있음, recovery 시작
  - 예상: 파랑색(#0099ff), "🔄" 아이콘
  - 검증:
    ✅ 진행률 표시
    ✅ 담당자 명시
    ✅ 예상 완료 시간

□ 테스트 6: 복구 완료 알림
  - 조건: Feature Flag 재활성화
  - 예상: 초록색(#36a64f), "✅" 아이콘
  - 검증:
    ✅ 복구 완료 명확
    ✅ 모든 검증 항목 PASS 표시
    ✅ 승인자 정보

□ 테스트 7: Slack 웹훅 오류 처리
  - 조건: SLACK_WEBHOOK_VERIFY 미설정 또는 실패
  - 예상: logger.warn/error만, 메인 로직 계속 진행
  - 검증:
    ✅ 롤백 진행 (Slack 실패해도)
    ✅ 로그에 오류 기록
    ✅ HTTP 응답 정상 (500 아님)
```

---

## 8. Slack 메시지 포맷 검증 규칙

```typescript
// slack-notifier.ts 검증 체크리스트

✅ 필수 필드
  - text: string (non-empty)
  - attachments: Array (length > 0)
  - attachments[0].fallback: string (non-empty)
  - attachments[0].color: string (hex color, 7자)
  - attachments[0].title: string (non-empty)
  - attachments[0].ts: number (unix timestamp)

✅ 컬러 매핑
  - DAILY_VERIFICATION: #36a64f (초록색)
  - CRITICAL_ROLLBACK: #ff0000 (빨강색)
  - ERROR_ROLLBACK: #ff6600 (주황색)
  - RECOVERY_STARTED: #0099ff (파랑색)
  - RECOVERY_COMPLETED: #36a64f (초록색)

✅ 타임스탐프 형식
  - ISO 8601: "2026-05-19T07:00:00Z"
  - Unix timestamp: Math.floor(Date.now() / 1000)

✅ JSON 직렬화
  - 순환 참조 없음
  - 대량 데이터 < 4000 자 (Slack 제한)
  - null/undefined 처리
```

---

## 9. 실제 테스트 명령어

### 로컬 테스트 (개발 환경)

```bash
# Slack 웹훅 설정 (선택, 테스트용 채널 사용)
export SLACK_WEBHOOK_VERIFY="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# 정상 검증 시뮬레이션
curl -X POST http://localhost:3000/api/cron/verify-execution-log

# 수동 롤백 테스트 (토큰 필요)
curl -X POST http://localhost:3000/api/admin/verification/rollback \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Test rollback",
    "adminEmail": "test@example.com"
  }'

# 복구 테스트
curl -X POST http://localhost:3000/api/admin/verification/recovery \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "enable_execution_log",
    "verificationStatus": "passed",
    "adminEmail": "test@example.com",
    "notes": "Test recovery"
  }'

# 상태 조회
curl -X GET http://localhost:3000/api/admin/verification/status \
  -H "Authorization: Bearer test-token"
```

### Slack 메시지 검증

```bash
# 수신된 메시지 형식 검증
jq '.' < slack_webhook_payload.json

# 색상 코드 검증
grep -E '#[0-9a-f]{6}' slack_messages.json
```

---

**최종 업데이트**: 2026-05-19
**담당팀**: CRM 개발팀 + 데이터팀
**검토 필수**: Slack 채널 `#crm-monitoring` 구독 확인
