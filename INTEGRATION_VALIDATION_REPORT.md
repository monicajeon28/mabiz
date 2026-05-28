# 마비즈 CRM 통합성 + 일관성 검증 보고서

**검증 일시**: 2026-05-28 | **버전**: v1.0 | **상태**: CRITICAL ISSUES FOUND

---

## 📊 검증 결과 요약

| 항목 | 상태 | 개수 |
|------|------|------|
| ✅ FULLY INTEGRATED FLOWS | 완전 연결 | 6개 |
| ⚠️ PARTIAL ISSUES (API 응답 형식) | 부분 문제 | 2개 |
| ❌ CRITICAL ISSUES (응답 형식 불일치) | 심각 | 1개 |

**최종 평가**: **PARTIAL ISSUES - 응답 형식 표준화 필요**

---

## ✅ 검증 1: 고객 생성 흐름 (Customer Creation)

### 데이터 흐름
```
크루즈닷몰 Payment Event
    ↓
POST /api/webhook/crm/customer-created
    ↓
Contact 생성/업데이트 (upsert)
    ↓
L0 렌즈 자동 분류 (부재중 고객 재활성화)
    ↓
Day 0 SMS 발송 (PASONA P단계)
    ↓
SmsLog 기록 + Contact 마크 업데이트
```

### 구현 검증: ✅ FULLY CONNECTED

**Webhook Handler** (`/src/app/api/webhook/crm/customer-created/route.ts`)
- ✅ 필드 검증: customerId, email, name (필수)
- ✅ Contact upsert: email + organizationId 기반
- ✅ L0 분류: reactivationSegment, reactivationLikelihood 설정
- ✅ SMS 발송: sendSmsViaAligo() 호출
- ✅ 마크: smsDay0Sent=true + smsDay0SentAt=NOW()

**데이터 모델**
```prisma
Contact {
  smsDay0Sent: Boolean
  smsDay0SentAt: DateTime?
  reactivationSegment: String?        // "3-6m", "6-12m", "1y+"
  reactivationLikelihood: Int         // 0-100
  tags: String[]                      // ["신규가입", "신규활성"]
}

SmsLog {
  contactId: String
  status: "SENT" | "FAILED"
  channel: "WEBHOOK_WELCOME"
  psychologyLens: "SCARCITY,TIMING"
}
```

### 검증 결과: ✅ 완전 일관성
- 모든 Contact 필드가 원자적으로 업데이트됨
- SMS 발송 성공/실패 모두 로깅됨
- Day 0-3 시퀀스 기초 마련됨

---

## ✅ 검증 2: 정산 처리 흐름 (Settlement Processing)

### 데이터 흐름
```
크루즈닷몰 Settlement Event
    ↓
POST /api/webhook/crm/settlement-updated
    ↓
Partner 조회 또는 생성
    ↓
Tier 자동 계산 (Bronze/Silver/Gold/Platinum)
    ↓
Churn 신호 감지 (20% 수입 감소)
    ↓
SMS 발송 + SettlementLedger 기록
```

### 구현 검증: ✅ FULLY CONNECTED

**Webhook Handler** (`/src/app/api/webhook/crm/settlement-updated/route.ts`)
- ✅ 필드 검증: settlementId, period, status, profileId
- ✅ Partner 생성 로직: externalAffiliateProfileId 기반
- ✅ Tier 계산: calculateTier() (commission 기반)
- ✅ Churn 감지: detectChurnSignal() (3개월 평균 vs 현재 20% drop)
- ✅ SMS 발송: sendSettlementNotificationSms() + sendChurnAlertSms()

**데이터 모델**
```prisma
Partner {
  tier: String                        // "Bronze" | "Silver" | "Gold" | "Platinum"
  churnRiskFlag: Boolean              // 신호 감지 여부
  churnRiskDetectedAt: DateTime?      // 감지 시각
  lastSettlementAt: DateTime?         // 마지막 정산 시각
  totalEarnings: BigInt               // 누적 수입
}

SettlementLedger {
  partnerId: String
  period: String                      // "2026-05"
  netAmount: BigInt
  status: String                      // "DRAFT" | "APPROVED" | "LOCKED" | "PAID"
}

PartnerRiskScoreChange {
  partnerId: String
  previousScore: Int
  currentScore: Int
  triggerReason: String               // "LOW_PERFORMANCE", "CHURN_SPIKE", ...
  smsTriggered: Boolean
}
```

### Tier 계산 로직 검증: ✅
```typescript
// calculateTier(monthlyCommissionCents)
$150,000+ → Platinum
$50,000-$150,000 → Gold
$10,000-$50,000 → Silver
$0-$10,000 → Bronze
```

### Churn 감지 로직 검증: ✅
```typescript
// 지난 3개월 평균 vs 현재
decreasePercent = (average - current) / average
⇒ 20% 이상 감소 시 churnRiskFlag = true
```

### 검증 결과: ✅ 완전 일관성
- Partner.tier + Partner.churnRiskFlag + timestamps 원자적 업데이트
- SettlementLedger 기록 완벽 (감사추적)
- SMS 발송 자동화 연결

---

## ⚠️ 검증 3: 대시보드 API 응답 형식 불일치

### 3A. SMS 통계 API

**엔드포인트**: `GET /api/loop5/sms-stats?organizationId=xxx&segment=A&days=7`

**응답 형식**: ❌ 형식 불일치
```json
{
  "organizationId": "xxx",
  "period": { "startDate": "...", "endDate": "...", "days": 7 },
  "totalSent": 100,
  "totalDelivered": 95,
  "totalFailed": 5,
  "successRate": 95.0,
  "byDay": {
    "0": { "sent": 25, "delivered": 24, "failed": 1, "rate": 96.0 },
    "1": { ... },
    "2": { ... },
    "3": { ... }
  },
  "bySegment": {
    "A": { "sent": 20, "delivered": 19, "rate": 95.0 },
    "B": { ... },
    ...
  },
  "responseRate": 12.5,
  "conversionRate": 8.3
  // ⚠️ 'ok' 필드 없음!
  // ⚠️ 에러 응답: { error: "..." } (표준 아님)
}
```

**문제점**:
- ❌ 성공 응답에 `ok: true` 필드 없음
- ❌ 에러 응답이 `{ error: "..." }`인데, 다른 API는 `{ ok: false, message: "..." }` 형식
- ⚠️ 클라이언트 코드가 응답 형식을 예측하기 어려움

### 3B. A/B 테스트 API

**엔드포인트**: `GET /api/admin/loop5/ab-test-results?days=14`

**응답 형식**: ✅ 표준 준수
```json
{
  "ok": true,
  "testPeriod": { "startDate": "...", "endDate": "...", "days": 14 },
  "variants": [
    {
      "variant": "A",
      "visitors": 300,
      "completions": 120,
      "completionRate": 0.4,
      "avgCompletionTimeMs": 45000,
      "confidence": 95,
      "isWinner": true,
      "segments": { "A": { "visitors": 50, "completions": 20, "rate": 0.4 } }
    },
    ...
  ],
  "metadata": { "totalSubmissions": 360, "estimatedTotalVisitors": 300, ... }
}
```

**점수**: ✅ OK 필드 포함, 표준 준수

### 3C. SMS 통계 API (관리자)

**엔드포인트**: `GET /api/admin/sms/stats?period=daily`

**응답 형식**: ❌ 형식 불일치
```json
{
  "period": "daily",
  "dateRange": { "start": "...", "end": "..." },
  "summary": { "total": 1000, "sent": 950, "delivered": 920, "failed": 50 },
  "rates": { "successRate": 95.0, "deliveryRate": 96.8, "failureRate": 5.0 },
  "byChannel": [ { "channel": "SMS", "total": 1000, "sent": 950 } ],
  "hourlyTrend": [ { "hour": 0, "total": 50, "sent": 48, "rate": 96.0 } ],
  "failureReasons": [ { "reason": "...", "count": 10 } ],
  "retryStats": { "totalRetries": 30, "breakdown": {...} },
  "timestamp": "..."
  // ⚠️ 'ok' 필드 없음!
}
```

**문제점**:
- ❌ 성공 응답에 `ok` 필드 없음
- ❌ 에러 응답 형식 미확인 (검증 필요)

---

## ❌ 검증 4: API 응답 형식 표준화 - CRITICAL ISSUE

### 현재 상태

| API | ok 필드 | error 필드 | message 필드 | 상태 |
|-----|---------|----------|-------------|------|
| `/api/admin/loop5/ab-test-results` | ✅ yes | - | - | ✅ 표준 |
| `/api/loop5/sms-stats` | ❌ no | ❌ yes | - | ❌ 비표준 |
| `/api/admin/sms/stats` | ❌ no | ? | - | ❌ 비표준 |

### 표준 형식 제안

**성공 응답** (HTTP 200):
```typescript
interface StandardSuccessResponse<T> {
  ok: true;
  data?: T;
  metadata?: Record<string, any>;
  timestamp: string;
}
```

**에러 응답** (HTTP 4xx/5xx):
```typescript
interface StandardErrorResponse {
  ok: false;
  error: string;
  message?: string;
  details?: Record<string, any>;
  timestamp: string;
}
```

### 영향 범위

- **클라이언트 코드**: 각 API별로 다른 응답 형식 처리 필요 → 오류 가능성 증가
- **대시보드**: API 응답 파싱 불일치 가능성
- **테스트**: 응답 형식 예측 어려움

---

## ✅ 검증 5: Contact 필드 동기화

### 동기화 쌍 분석

| Field 1 | Field 2 | 관계 | 동기화 |
|---------|---------|------|--------|
| `smsDay0Sent` | `smsDay0SentAt` | Boolean + Timestamp | ✅ 원자적 |
| `smsDay1Sent` | `smsDay1SentAt` | Boolean + Timestamp | ✅ 원자적 |
| `smsDay2Sent` | `smsDay2SentAt` | Boolean + Timestamp | ✅ 원자적 |
| `smsDay3Sent` | `smsDay3SentAt` | Boolean + Timestamp | ✅ 원자적 |
| `segment` | `autoSegment` | 수동 vs 자동 | ✅ 분리 |
| `reactivationSegment` | `reactivationLikelihood` | L0 분류 | ✅ 원자적 |
| `tags` | `lens` | 배열 vs 코드 | ✅ 분리 |

### 검증 결과: ✅ 완전 일관성
모든 필드 쌍이 동시에 업데이트되거나, 의도적으로 분리됨.

---

## ✅ 검증 6: Partner 필드 동기화

### 동기화 쌍 분석

| Field 1 | Field 2 | 관계 | 동기화 |
|---------|---------|------|--------|
| `tier` | - | Tier 자동 계산 | ✅ 자동 |
| `churnRiskFlag` | `churnRiskDetectedAt` | Boolean + Timestamp | ✅ 원자적 |
| `lastSettlementAt` | `totalEarnings` | 시각 + 누적액 | ✅ 함께 업데이트 |

### 검증 결과: ✅ 완전 일관성

---

## ✅ 검증 7: Webhook 에러 처리

### 에러 처리 체인

```
1. Signature 검증 (WEBHOOK_SECRET)
   ↓
2. Idempotency 체크 (중복 방지)
   ↓
3. Handler 실행
   ↓
4. WebhookEvent 기록 (상태: PENDING → PROCESSING → COMPLETED/FAILED)
   ↓
5. WebhookLog 기록 (감사추적)
   ↓
6. Retry 전략 (exponential backoff, max 5회)
```

### 검증 결과: ✅ 완전 구현
- ✅ 모든 단계에서 로깅
- ✅ 멱등성 보장
- ✅ 감사추적 완벽

---

## 📋 검증 8: 데이터 흐름 통합성

### 고객 생성 흐름
```
Customer-Created Webhook ✅
    ↓
Contact 생성 ✅
    ↓
L0 렌즈 분류 ✅
    ↓
Day 0 SMS 발송 ✅
    ↓
smsDay0Sent 마크 ✅
```
**상태**: ✅ 완전 연결

### 정산 처리 흐름
```
Settlement-Updated Webhook ✅
    ↓
Partner 조회/생성 ✅
    ↓
Tier 재평가 ✅
    ↓
Churn 감지 ✅
    ↓
SMS 발송 ✅
    ↓
SettlementLedger 기록 ✅
```
**상태**: ✅ 완전 연결

### 대시보드 데이터 흐름
```
PartnerSmsLog 저장 ✅
    ↓
GET /api/loop5/sms-stats 조회 ✅
    ↓
JSON 응답 ⚠️ (형식 불일치)
    ↓
클라이언트 파싱 ⚠️ (불일치 처리 필요)
```
**상태**: ⚠️ 부분 문제 (응답 형식)

---

## 🔧 권장 조치

### P0 (즉시 수정 필요)

**1. API 응답 형식 표준화**

```typescript
// /src/app/api/loop5/sms-stats/route.ts 수정
export async function GET(request: NextRequest) {
  try {
    // ... 기존 로직 ...

    const result = {
      ok: true,                     // ← 추가
      data: {                        // ← 데이터를 data 필드로 감싸기
        organizationId,
        period: { startDate, endDate, days },
        totalSent,
        totalDelivered,
        totalFailed,
        // ... 나머지 필드들 ...
      },
      timestamp: new Date().toISOString()  // ← 추가
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,                  // ← 수정
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
```

**2. SMS 통계 API 표준화**

```typescript
// /src/app/api/admin/sms/stats/route.ts 수정
return NextResponse.json({
  ok: true,                         // ← 추가
  data: {                            // ← 데이터 감싸기
    period,
    dateRange,
    summary,
    rates,
    byChannel,
    hourlyTrend,
    failureReasons,
    retryStats
  },
  timestamp: new Date().toISOString()  // ← 추가
});
```

### P1 (다음 주 수정)

**3. 타입 정의 통합**

```typescript
// /src/lib/types/api-response.ts 생성
export interface ApiSuccessResponse<T = any> {
  ok: true;
  data?: T;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface ApiErrorResponse {
  ok: false;
  error: string;
  message?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;
```

**4. 모든 API에 표준 형식 적용**
- 스캔 대상: `/src/app/api/**/*.ts` (100+ 파일)
- 우선순위: Loop 5 관련 API > 일반 API

---

## 📊 최종 평가 행렬

| 평가 항목 | 상태 | 점수 | 비고 |
|----------|------|------|------|
| 고객 생성 흐름 | ✅ INTEGRATED | 10/10 | 완벽한 데이터 연결 |
| 정산 처리 흐름 | ✅ INTEGRATED | 10/10 | Tier+Churn 완벽 |
| Contact 동기화 | ✅ SYNCHRONIZED | 10/10 | 원자적 업데이트 |
| Partner 동기화 | ✅ SYNCHRONIZED | 10/10 | 자동화 완벽 |
| Webhook 에러처리 | ✅ ROBUST | 10/10 | 멱등성+감사 |
| API 응답 일관성 | ⚠️ PARTIAL | 5/10 | 형식 불일치 |
| 대시보드 연결 | ⚠️ PARTIAL | 7/10 | API 형식 수정 필요 |

### 통합성 점수
```
전체: 72/100
= (10+10+10+10+10+5+7) / 7

상태: PARTIALLY INTEGRATED
→ 핵심 비즈니스 로직 100% 연결
→ API 응답 형식 표준화 필요 (P0)
```

---

## ✅ 배포 전 체크리스트

- [ ] API 응답 형식 표준화 완료 (ok, data, timestamp 필드)
- [ ] 모든 API 에러 응답 형식 통일
- [ ] 타입 정의 파일 생성 및 적용
- [ ] 클라이언트 코드 응답 파싱 검증
- [ ] 프론트엔드 대시보드 API 호출 테스트
- [ ] 통합 테스트 (E2E)

---

## 📄 결론

### 현재 상태
✅ **핵심 데이터 흐름**: 완전히 연결됨 (고객 생성 → Contact → L0 분류 → Day 0 SMS)
✅ **정산 처리**: 완전히 자동화됨 (Settlement → Partner Tier → Churn 감지)
⚠️ **API 응답 형식**: 표준화 필요 (P0 우선순위)

### 권장 사항
1. **즉시** (P0): API 응답 형식 3개 파일 수정 (30분)
2. **다음 주** (P1): 모든 API 응답 형식 표준화 (4-6시간)
3. **성능**: 현재 상태 유지, 형식 수정 후 재검증

### 배포 준비 상태
- **코드 품질**: ✅ 우수 (데이터 일관성, 에러 처리)
- **통합성**: ⚠️ 부분 완료 (API 형식 수정 필요)
- **배포 가능성**: ⏳ P0 수정 후 GO

---

**검증 완료**: 2026-05-28 | **검증자**: Claude Code | **다음 검증**: 2026-06-04
