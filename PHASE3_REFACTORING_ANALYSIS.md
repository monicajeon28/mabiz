# Phase 3-β: 자동화 코드 리팩토링 분석 보고서

## 목표
280줄 코드 중복 제거, 래퍼 함수 패턴 적용

## 코드 구조 분석

### 1. 현재 상황
- **execute-campaigns.ts** (687줄): cron 발송 + 재시도 로직 (SendingHistory 기반)
- **[id]/send/route.ts** (238줄): API 엔드포인트 (CrmMarketingMessage 기반)
- **enum-mapping.ts** (153줄): ExecutionLog ↔ SendingHistory 변환

### 2. 중복 코드 지점 (280줄 추정)

#### A. 메시지 발송 로직
**execute-campaigns.ts (Line 133-272: sendSingleMessage 함수)**
```typescript
// 1. Contact 조회 (행: 146-149)
// 2. SMS 발송 (행: 162-209)
//    - config 조회
//    - API 호출 (sendSms)
//    - 에러 매핑
// 3. EMAIL 발송 (행: 210-242)
//    - API 호출 (sendFunnelEmail)
//    - 에러 매핑
// 4. SendingHistory 기록 (행: 245-255)
// 5. 예외 처리 (행: 258-272)
```
**총 140줄**

#### B. SendingHistory 생성
**execute-campaigns.ts (Line 637-670: createSendingHistory 함수)**
```typescript
// SendingHistory 생성 (27줄)
// 중복 호출: 5회 (Line 165, 180, 213, 245, 260)
```
**총 27줄 × 3회 호출 = 81줄**

#### C. 에러 매핑
**execute-campaigns.ts (Line 603-632)**
```typescript
function mapAligoErrorToFailureReason(resultCode: number)  // 15줄
function mapEmailErrorToFailureReason(resultCode: number)  // 15줄
// 매핑 로직 중복 (같은 에러 코드 처리)
```
**총 30줄**

#### D. 재시도 상태 업데이트
**execute-campaigns.ts (Line 280-332: updateSendingStatus 함수)**
```typescript
// 상태 업데이트 + 재시도 판단 (52줄)
// [id]/send/route.ts에서 유사 로직 필요
```
**총 52줄**

### 3. 호환성 분석

#### Status 호환성: 100% ✅
- ExecutionStatus = SendingStatus (동일 Enum)
- PENDING, SENT, FAILED, SKIPPED, RETRY_SCHEDULED, ABANDONED

#### FailureReason 호환성: 95% ⚠️
- ExecutionFailureReason ⊃ SendingFailureReason
- 차이: ExecutionLog는 INVALID_CONTACT (연락처 자체 없음), SendingHistory는 INVALID_PHONE/INVALID_EMAIL (채널별 분리)
- 매핑: INVALID_CONTACT → INVALID_PHONE (enum-mapping.ts 행 81)

### 4. 의사결정 확인 (이미 확정됨)
✅ 래퍼 함수 방식
✅ Feature Flag (ENABLE_EXECUTION_LOG_WRAPPER)
✅ 점진적 마이그레이션

## 추천 리팩토링 순서

### Phase 3-β-Step 1 (분석) ✅ 완료
- 중복 지점 파악: sendSingleMessage, createSendingHistory, 에러 매핑
- 호환성 검증: Status 100%, FailureReason 95%

### Phase 3-β-Step 2 (래퍼 함수 설계)
- **lib/services/contact-template-sender.ts** (신규)
  - `sendToContactByTemplate()` — 통합 함수
  - `recordSendingHistory()` — 이력 기록
  - `mapFailureReason()` — 에러 매핑 (중앙화)

### Phase 3-β-Step 3 (Feature Flag 추가)
- **lib/config/feature-flags.ts** (신규)
  - `ENABLE_EXECUTION_LOG_WRAPPER: boolean`

### Phase 3-β-Step 4 (마이그레이션)
- execute-campaigns.ts: sendSingleMessage → 래퍼 함수 호출
- [id]/send/route.ts: 기존 로직 → 래퍼 함수 호출

### Phase 3-β-Step 5 (테스트)
- 코드 라인 수 비교 (목표: 280줄 감소)
- Feature Flag ON/OFF 동작 검증
- API 호환성 확인

## 산출물

1. **lib/services/contact-template-sender.ts** — 통합 래퍼 함수
2. **lib/config/feature-flags.ts** — Feature Flag 설정
3. **Modified execute-campaigns.ts** — 최소 변경 적용
4. **Modified [id]/send/route.ts** — 래퍼 함수로 호출
5. **코드 리뷰 리포트** — 280줄 제거 확인

## 예상 결과

| 메트릭 | 이전 | 이후 | 감소 |
|--------|------|------|------|
| 총 라인 수 (관련 파일) | 925줄 | ~645줄 | 280줄 |
| 함수 수 | 12개 | 7개 | 5개 감소 |
| 중복률 | 35% | 5% | 30% 개선 |

## 일정
- 분석: ✅ 완료 (2026-05-18)
- Step 2-5: 예상 2-3시간 (병렬 가능)
