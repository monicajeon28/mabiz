# 크루즈닷 ↔ CRM 웹훅/API 연동 구조 분석

**분석 일자:** 2026-05-21  
**상태:** Phase 2 구현 완료, Phase 3+ 부분 대기  
**작성자:** Claude Code Agent

---

## 목차

1. [웹훅 플로우 다이어그램](#웹훅-플로우-다이어그램)
2. [API 엔드포인트 상태표](#api-엔드포인트-상태표)
3. [구현된 웹훅 상세](#구현된-웹훅-상세)
4. [미구현 웹훅 목록](#미구현-웹훅-목록)
5. [DLQ & 재시도 메커니즘](#dlq--재시도-메커니즘)
6. [보안 체크리스트](#보안-체크리스트)
7. [양방향 동기화 문제점](#양방향-동기화-문제점)
8. [성능 & 지연 문제](#성능--지연-문제)
9. [권장 개선 사항](#권장-개선-사항)

---

## 웹훅 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                    크루즈닷몰 (GMcruise B2C)                          │
└──────┬──────────┬──────────┬──────────┬──────────┬────────────────────┘
       │          │          │          │          │
   [구매]     [환불]    [계약서]    [리드상태]   [상품정보]
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
┌──────────────┬─────────────┬──────────────┬──────────────┬──────────┐
│ /purchase    │ /refund     │ /contract    │ /lead-status │ /product │
│              │             │ -signed      │              │ (미구현) │
│ [2단계]      │ [1단계]     │ [1단계]      │ [1단계]      │ [0단계]  │
└──────┬───────┴──────┬──────┴───────┬──────┴──────┬───────┴──────┬────┘
       │              │              │              │              │
       ▼              ▼              ▼              ▼              ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │          CRM (mabiz-crm)                                        │
   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
   │  │   Contact    │  │ AffiliateSale│  │ Organization│           │
   │  │   (B2C)      │  │  (수당 추적) │  │ (파트너)    │           │
   │  │              │  │              │  │              │           │
   │  │ [purchasedAt]│  │ [commission] │  │ [signedAt]   │           │
   │  │ [lastRefund] │  │ [status]     │  │ [ownerInfo]  │           │
   │  └──────────────┘  └──────────────┘  └──────────────┘           │
   │                                                                   │
   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
   │  │ CruiseProduct│  │ ContactMemo  │  │DLQ/ProcessedEvent         │
   │  │ (상품마스터) │  │ (자동기록)   │  │ (재시도/멱등)│           │
   │  │              │  │              │  │              │           │
   │  │ [basePrice]  │  │ [leadStatus] │  │ [retryCount]│           │
   │  │ [nights/days]│  │ [refund]     │  │ [nextRetry] │           │
   │  └──────────────┘  └──────────────┘  └──────────────┘           │
   └─────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│               페이앱 (PayApp B2B)                                     │
└─────────────┬──────────────────────────────────┬──────────────────────┘
              │                                  │
          [결제]                             [취소/부분취소]
              │                                  │
              ▼                                  ▼
       ┌─────────────┐                    ┌─────────────┐
       │ /payapp     │                    │ /payapp     │
       │ (Feedback)  │                    │ /refund     │
       │ [1단계]     │                    │ [1단계]     │
       └──────┬──────┘                    └──────┬──────┘
              │                                  │
              ▼                                  ▼
       ┌─────────────────────────────────────────────────┐
       │ CRM PayAppPayment (B2B 전용)                   │
       │ - 크루즈닷몰 공유 테이블 건드리지 않음         │
       │ - status: paid/pending/refunded/partial_refunded│
       │ - 부분환불 이력: metadata.refund_history      │
       └─────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│          CRM 내부 → SMS/이메일 발송 (콜백)                          │
└──────────┬──────────────────────────────────────────────────────────┘
           │
       [상태 업데이트]
           │
           ▼
  ┌──────────────────────────────┐
  │ /execution-status (콜백)    │
  │ - SENT/FAILED 상태 업데이트 │
  │ - SendingHistory 갱신       │
  │ - 실패 시 재시도 가능        │
  └──────────────────────────────┘
```

---

## API 엔드포인트 상태표

### 크루즈닷몰 → CRM (수신)

| # | 엔드포인트 | 트리거 | 구현 | 스테이지 | 필수파라미터 | 보안 | DLQ | 멱등성 | 주요기능 |
|---|-----------|--------|-----|---------|---------|------|-----|--------|---------|
| 1 | `POST /webhooks/purchase` | 결제완료 | ✅ | **2단계** (Phase 2 진행) | phone, name, orderId | Bearer Token | ✅ | eventId | Contact upsert + AffiliateSale 생성 + 상품마스터 자동등록 |
| 2 | `POST /webhooks/refund` | 환불완료 | ✅ | **1단계** (Phase 2 진행) | orderId | Bearer Token | ✅ | eventId | Contact type→REFUNDED + 수당 100% 취소 + 메모기록 |
| 3 | `POST /webhooks/cruise-purchase` | VIP구매 | ✅ | **1단계** (Phase 1 완료) | buyerTel, orderId, affiliateCode | x-webhook-secret | ✅ | orderId | Contact 생성 + AffiliateSale 기록 (commission 미포함) |
| 4 | `POST /webhooks/gmcruise/contract-signed` | 계약서서명 | ✅ | **1단계** (Phase 1 완료) | contractRef, ownerName, ownerPhone, orgName | X-Signature (HMAC) | ✅ | eventId/contractRef | Organization 자동생성 + GLOBAL_ADMIN 이메일 알림 |
| 5 | `POST /webhooks/gmcruise/lead-status` | 리드상태변경 | ✅ | **1단계** (Phase 1 완료) | eventId, status | Bearer Token | ✅ | eventId | ContactMemo 자동기록 (type변경안함) |
| 6 | `POST /webhooks/product` | 상품등록/수정 | ❌ | **0단계** (요청만 접수) | productCode, packageName, basePrice | Bearer Token | ⏳ | ⏳ | **미구현** — CruiseProduct 자동등록/갱신 |
| 7 | `POST /webhooks/gmcruise/passport-approved` | 여권승인 | ✅ | **1단계** (Phase 1) | leadId, passportStatus | Bearer Token | ✅ | eventId | ContactMemo 기록 (차이점: 기항지정보 미포함) |
| 8 | `POST /webhooks/gmcruise/payment-failure` | 결제실패 | ✅ | **1단계** (Phase 1) | leadId, reason | Bearer Token | ✅ | eventId | ContactMemo 기록 (Contact type 변경안함) |

### PayApp (B2B) → CRM (수신)

| # | 엔드포인트 | 트리거 | 구현 | 스테이지 | 보안 | DLQ | 멱등성 | 주요기능 |
|---|-----------|--------|-----|---------|------|-----|--------|---------|
| 1 | `POST /webhooks/payapp` | 결제/취소 | ✅ | **1단계** (Phase 2 진행) | IP Whitelist + linkval HMAC | ✅ | orderId | PayAppPayment 생성/갱신 + 부분환불이력 추적 |
| 2 | `POST /api/payapp/refund` | 환불요청 (UI) | ✅ | **1단계** (Phase 2) | RBAC (orgId) | ✅ | paymentId | PayApp API 호출 + DB 부분환불이력 기록 |

### CRM → 크루즈닷몰 (송신) / 콜백 (수신)

| # | 엔드포인트 | 방향 | 구현 | 스테이지 | 목적 |
|---|-----------|------|-----|---------|------|
| 1 | `POST /webhooks/execution-status` | 수신(콜백) | ✅ | **2단계** (Phase 2 진행) | SMS/이메일 발송 상태 업데이트 (SENT/FAILED) + DLQ |
| 2 | `PUT /contacts/[id]` | 송신 | ❌ | **0단계** | 크루즈닷몰 Contact 동기화 (미구현) |
| 3 | `POST /integration/refund-reversal` | 송신 | ❌ | **0단계** | 환불취소 알림 (CRM→크루즈닷몰) |

### 페이앱 (B2B) ← CRM (송신)

| # | 엔드포인트 | 방향 | 구현 | 목적 |
|---|-----------|------|-----|------|
| 1 | `POST /payapp/payments` | 송신 (결제 요청) | ✅ | B2B 교육상품 결제 |
| 2 | `POST /payapp/refund` | 송신 (환불 요청) | ✅ | B2B 결제 취소 |

---

## 구현된 웹훅 상세

### 1. POST /api/webhooks/purchase (크루즈닷몰 B2C 구매)

**상태:** ✅ **구현 완료** | 스테이지: **Phase 2** (2단계 웹훅)

**인증:**
```
Authorization: Bearer {MABIZ_PURCHASE_WEBHOOK_SECRET}
```

**페이로드 (필수/선택):**
```json
{
  "phone": "01012345678",        // ✅ 필수
  "name": "김고객",               // ✅ 필수
  "orderId": "ORD-2026-001",      // ✅ 필수 (중복방지)
  "affiliateCode": "PARTNER-A",   // ✅ 필수 (수당추적)
  "productName": "7박 캐리비안 크루즈",
  "saleAmount": 3500000,
  "commissionRate": 5.0,          // 📬 2단계에서 전달 (관리자 승인 후)
  "commissionAmount": 175000,
  "eventId": "evt_abc123",        // ✅ 멱등성 체크용
  "departureDate": "2026-06-15",
  "customerEmail": "guest@example.com",
  "productCode": "CP-2026-001",   // ✅ 상품마스터 자동등록 트리거
  "basePrice": 3500000,
  "nights": 7,
  "days": 8,
  "cruiseLine": "Royal Caribbean",
  "shipName": "Harmony of the Seas",
  "headcount": 2,
  "cabinType": "Inside Cabin"
}
```

**처리 흐름:**
```
1. eventId 멱등성 체크 (이미 처리됨 → 200 OK)
2. organizationId 결정 (affiliateCode → AffiliateSale/Contact 역추적)
3. Contact upsert (phone + organizationId 기준)
   - 신규: CREATE (type='CUSTOMER', channel='b2c')
   - 기존: UPDATE (purchasedAt, productName 등)
4. CruiseProduct upsert (productCode 기준) ← NEW
   - basePrice, nights, days, startDate 자동저장
   - 상품 사전등록 없어도 구매 시 자동생성
5. AffiliateSale upsert (orderId 기준)
   - 1단계: commissionRate=null (관리자 승인 전)
   - 2단계: commissionRate 확정값으로 갱신
6. VIP 그룹 자동배정 + 퍼널트리거
7. processedWebhookEvent 기록
```

**문제점:**
- ❌ **1단계/2단계 구분:** 같은 orderId로 2번 오는데, 현재 구현은 이미 처리된 sale을 upsert하므로 OK
- ⚠️ **상품마스터 충돌:** 같은 productCode가 여러 번 오면? → 마지막 데이터가 우선 (덮어쓰기)
- ⚠️ **금액 검증 부족:** saleAmount 값을 그대로 기록 (위조 가능성)

**DLQ:** ✅ 500에러 시 자동 등록 (최대 3회 재시도: 5분→15분→60분)

---

### 2. POST /api/webhooks/refund (크루즈닷몰 환불)

**상태:** ✅ **구현 완료** | 스테이지: **Phase 2**

**특이사항:**
- ⚠️ **CRM은 "알림만" 받음** — AffiliateSale 테이블은 절대 수정하지 않음
- ✅ **Contact 상태 변경:** type='REFUNDED' + lastPaymentStatus='refunded'
- ✅ **수당 100% 취소:** commissionAmount=0 (P0 요구사항)
- ✅ **부분환불 이력:** 메모에 기록

**처리:**
```
1. eventId 멱등성 체크
2. orderId → AffiliateSale 찾기 (수당정보 조회)
3. orderId(bookingRef) → Contact 찾기
4. 트랜잭션:
   - Contact: type→REFUNDED, lastPaymentStatus→'refunded'
   - ContactMemo: [환불완료] {금액}원 / 사유 / 주문번호 기록
   - AffiliateSale: commissionAmount→0, status→'REFUNDED', refundedAmount 기록
   - processedWebhookEvent: 멱등성 기록
```

**DLQ:** ✅ 500에러 시 자동 재시도

---

### 3. POST /api/webhooks/cruise-purchase (VIP 구매)

**상태:** ✅ **구현 완료** | 스테이지: **Phase 1**

**특이사항:**
- 🔄 **이전 구현:** `/purchase` 웹훅 이전 단계 (거의 비슷하지만 더 단순)
- ⚠️ **affiliateCode 필수:** 조직을 특정할 수 없으면 처리 불가 (400)
- 📌 **commission 미포함:** commissionRate/Amount 없음 (→ 0으로 초기화)

**DLQ:** ✅ 500에러 시 자동 재시도

---

### 4. POST /api/webhooks/gmcruise/contract-signed (파트너 계약서)

**상태:** ✅ **구현 완료** | 스테이지: **Phase 1**

**보안:**
```
X-Signature: sha256=<HMAC-SHA256(rawBody)>
X-Timestamp: <unix-ms> (±5분 유효기간)
```

**처리:**
```
1. HMAC-SHA256 서명 검증 (rawBody 기준)
2. eventId 멱등성 체크
3. Organization 자동생성 또는 기존 조직 반환
4. GLOBAL_ADMIN_NOTIFY_EMAIL로 이메일 발송
```

**DLQ:** ✅ 500에러 시 자동 재시도

---

### 5. POST /api/webhooks/gmcruise/lead-status (리드 상태변경)

**상태:** ✅ **구현 완료** | 스테이지: **Phase 1**

**특이사항:**
- ⚠️ **type 변경 안함:** PURCHASED/REFUNDED는 별도 웹훅으로 처리
- 📌 **affiliateCode만으로 조직 찾음:** phone 없음
- ✅ **ContactMemo 자동기록:** "상태변경: {이전상태} → {현재상태}"

**DLQ:** ✅ 500에러 시 자동 재시도

---

### 6. POST /api/webhooks/execution-status (SMS/이메일 콜백)

**상태:** ✅ **구현 완료** | 스테이지: **Phase 2**

**역할:** CRM → Aligo(SMS)/SendGrid(이메일) 발송 후 상태 콜백

**보안:**
```
X-Signature: sha256=<HMAC-SHA256(body)>
```

**처리:**
```
1. 서명 검증
2. eventId 멱등성 체크
3. SendingHistory 상태 업데이트 (SENT/FAILED)
4. 실패 시 failureReason 기록
5. processedWebhookEvent 기록
```

**DLQ:** ✅ 500에러 시 자동 재시도

---

### 7. POST /api/webhooks/payapp (PayApp B2B 결제/취소)

**상태:** ✅ **구현 완료** | 스테이지: **Phase 2**

**보안:**
```
IP Whitelist (PAYAPP_ALLOWED_IPS)
linkval HMAC 검증
```

**pay_state 매핑:**
- `4` → paid (결제완료)
- `70, 71` → partial_refunded (부분취소)
- `8, 9, 16, 32, 64` → refunded (전체취소)

**특이사항:**
- ⚠️ **B2B 전용:** PayAppPayment만 사용 (크루즈닷몰 테이블 건드리지 않음)
- ✅ **부분환불 추적:** metadata.refund_history 배열에 누적
- ✅ **가상계좌 지원:** pay_state=10 (대기상태)

**DLQ:** ✅ (기존 DLQ 함수 아님 — 별도 응답 처리)

---

## 미구현 웹훅 목록

### Phase 0: 요청 접수만 됨

#### 1. POST /api/webhooks/product (상품 마스터 동기화)

**상태:** ❌ **미구현** | 요청: 2026-05-16 | 상태: 📬 **개발 대기**

**필요성:**
- 현재: 구매 시 `purchase` 웹훅으로 상품정보 수신 (reactive)
- 요청: 구매 전에 상품정보 미리 등록/갱신 (proactive)

**페이로드:**
```json
{
  "eventId": "evt_a1b2c3d4",
  "eventType": "product.created | product.updated",
  "productCode": "CP-2026-05-001",    // unique key
  "packageName": "7박 8일 카리브해 크루즈",
  "cruiseLine": "Royal Caribbean",
  "shipName": "Harmony of the Seas",
  "basePrice": 1250000,
  "nights": 7,
  "days": 8,
  "startDate": "2026-06-15",
  "endDate": "2026-06-22",
  "isActive": true,
  "saleStatus": "AVAILABLE",
  "commissionRate": 5.0,              // 신규: 상품별 수수료율
  "commissionAmount": 62500,
  "refundPolicy": {                   // 신규: 환불정책
    "slots": [
      { "daysBeforeDep": 60, "penaltyRate": 0 },
      { "daysBeforeDep": 30, "penaltyRate": 25 }
    ]
  },
  "itineraryPattern": [               // 신규: 기항지
    { "type": "port", "location": "산후안", "country": "푸에르토리코" },
    { "type": "port", "location": "조지아운", "country": "터크스 케이커스" }
  ]
}
```

**예상 처리:**
```
1. eventId 멱등성 체크
2. CruiseProduct upsert (productCode 기준)
   - 신규: CREATE (모든 필드)
   - 기존: UPDATE (가격, 수당률, 상태 등)
3. RefundPolicy 저장 (신규 필드)
4. ItineraryPattern 저장 (신규 필드)
5. CommissionTemplate 갱신 (상품별 수수료)
```

**DLQ:** ✅ 예상 구현

**우선순위:** **🔴 P1** — 상품 마스터 프로액티브 동기화

---

### Phase 0: 미설계 웹훅들

#### 2. PUT /api/contacts/[id] (CRM → 크루즈닷몰 회원정보 역동기화)

**상태:** ❌ **미구현** | 요청: 없음 | 상태: **⏳ 설계 필요**

**목적:**
```
CRM에서 Contact 정보 수정 → 크루즈닷몰 회원정보 자동 업데이트
예: 이름/전화번호 변경, 주소추가, 상태변경 등
```

**필요 정보:**
- Webhook URL: `https://api.cruisedot.co.kr/contacts/{memberId}`
- 인증: HMAC-SHA256
- 트리거: Contact 수정 시 (모든 필드 vs 특정 필드만?)
- 멱등성: Contact ID + timestamp
- 페이로드: 어느 필드까지 동기화?

**우선순위:** **🟡 P2** — 양방향 동기화는 나중에

---

#### 3. POST /api/integration/refund-reversal (환불취소)

**상태:** ❌ **미구현** | 요청: 없음 | 상태: **⏳ 설계 필요**

**목적:**
```
CRM 환불 실수 시 취소 (환불을 안 받겠다고 한 경우)
→ 크루즈닷몰에 환불취소 알림
```

**필요 정보:**
- 엔드포인트
- 트리거 시점
- 페이로드 형식
- 보안 방식

**우선순위:** **🟢 P3** — edge case

---

#### 4. POST /api/webhooks/product-inventory (상품 재고)

**상태:** ❌ **미구현** | 요청: 없음 | 상태: **⏳ 설계 필요**

**목적:**
```
크루즈선실 재고 실시간 업데이트
예: "Inside Cabin 4개 남음" → CRM 대시보드 표시
```

**우선순위:** **🟡 P2** — 수요에 따라

---

#### 5. POST /api/webhooks/pricing-update (가격 변경)

**상태:** ❌ **미구현** | 요청: 없음 | 상태: **⏳ 설계 필요**

**목적:**
```
상품 가격 변경 시 CRM 알림 (commission 재계산 등)
```

**우선순위:** **🟡 P2** — 회계 연동 필요 시

---

---

## DLQ & 재시도 메커니즘

### 아키텍처

**파일:** `src/lib/mabiz-dlq.ts`

```typescript
// DLQ 엔트리: MabizSyncDLQ 테이블
{
  id: string;              // 고유 ID
  webhookType: string;     // 'purchase', 'refund', 'payapp' 등
  payload: object;         // 원본 페이로드
  failureReason: string;   // 오류 메시지
  retryCount: number;      // 현재 재시도 횟수 (0~3)
  maxRetries: number = 3;  // 최대 재시도
  nextRetryAt: datetime;   // 다음 재시도 시간
  resolvedAt?: datetime;   // 해결 시간 (null = 미해결)
  createdAt: datetime;
  updatedAt: datetime;
}
```

### 재시도 일정

```
재시도 1: 5분 후   (1회 실패 후)
재시도 2: 15분 후  (2회 실패 후)
재시도 3: 60분 후  (3회 실패 후)
재시도 4: 없음     (3회 초과 → 수동처리 필요)
```

### 코드 예시

```typescript
// 1. 웹훅 실패 시 DLQ 등록
try {
  // 처리 로직
} catch (err) {
  await enqueueDLQ('purchase', body, err.message);
  return NextResponse.json({ ok: false }, { status: 500 });
}

// 2. Cron 작업으로 정기 재시도 (예: /api/cron/retry-dlq)
const pending = await getPendingDLQEntries(20);
for (const entry of pending) {
  try {
    await retryWebhook(entry);
    await resolveDLQ(entry.id);
  } catch (err) {
    await failDLQ(entry.id, entry.retryCount, err.message);
  }
}
```

### 현재 상태

✅ **기본 틀 완료:**
- enqueueDLQ, resolveDLQ, failDLQ, getPendingDLQEntries 구현됨
- 각 웹훅에서 사용 중

⚠️ **부족한 부분:**
- 🔴 **Cron 작업 미구현:** 실제 재시도하는 cron 없음 (손실 위험)
- 🔴 **모니터링 부족:** 3회 초과 실패 건 → 대시보드에 노출 안함
- 🔴 **재시도 로직 불명확:** 웹훅마다 재시도 로직 다를 수 있음

---

## 보안 체크리스트

### 1. 인증 (Authentication)

| 웹훅 | 방식 | 검증 | 문제점 |
|------|------|------|--------|
| purchase | Bearer Token | timingSafeEqual ✅ | Secret 길이 확인 후 비교 OK |
| refund | Bearer Token | timingSafeEqual ✅ | OK |
| cruise-purchase | x-webhook-secret | timingSafeEqual ✅ | OK |
| contract-signed | X-Signature (HMAC) | verifyGmcruiseWebhook ✅ | 타임스탬프 ±5분 검증 |
| lead-status | Bearer Token | timingSafeEqual ✅ | OK |
| execution-status | X-Signature (HMAC) | verifyWebhookSignature ✅ | OK |
| payapp | IP Whitelist + linkval | validateFeedback ✅ | ⚠️ IP 미설정 시 경고만 함 |

**결론:** ✅ **양호** — 모두 구현됨

---

### 2. TOCTOU (Time-of-Check-Time-of-Use) 공격 방지

#### 멱등성 체크

| 웹훅 | 키 | 저장소 | 문제점 |
|------|-----|--------|--------|
| purchase | eventId | processedWebhookEvent | ✅ 트랜잭션 내에서 처리 |
| refund | eventId | processedWebhookEvent | ✅ 트랜잭션 내에서 처리 |
| cruise-purchase | orderId | affiliateSale(unique) | ⚠️ 별도 트랜잭션 |
| contract-signed | eventId/contractRef | processedWebhookEvent | ✅ 트랜잭션 내 체크 후 처리 |
| payapp | orderId | payAppPayment(unique) | ✅ findUnique 사용 |

**발견:** 🔴 **cruise-purchase는 위험**
```typescript
// 현재 코드 (TOCTOU 취약)
const existingDuplicate = await prisma.affiliateSale.findUnique({ where: { orderId } });
if (existingDuplicate) return; // ← 이 사이에 다른 요청이 들어올 수 있음!
await tx.affiliateSale.create(...); // ← Race condition 가능

// 개선안
await tx.affiliateSale.create({
  data: { orderId, ... },
  // create가 실패 → unique 제약 위반 → 이미 존재
});
```

---

### 3. 입력값 검증 (Input Validation)

| 웹훅 | 검증 | 문제점 |
|------|------|--------|
| purchase | phone(필수), name(필수), orderId(필수) | ⚠️ 금액 범위 체크 없음 (saleAmount: 0~무한대) |
| refund | orderId(필수), amount 범위 체크 | ✅ finalAmount = amount ?? refundAmount ?? 0 |
| cruise-purchase | buyerTel(필수), orderId(필수) | ✅ amount 범위검증 (0~1억) |
| payapp | phone, orderId, price | ⚠️ price < 0 허용? (parseInt 결과 확인 필요) |

**발견:** 🔴 **purchase: saleAmount 검증 부족**
```typescript
// 현재 코드
const finalSaleAmount = parseInt(String(saleAmount ?? amount)) || 0;
// 개선안
const finalSaleAmount = Math.max(0, Math.min(100_000_000, parseInt(String(saleAmount ?? amount)) || 0));
```

---

### 4. 데이터 격리 (Data Isolation)

#### B2C vs B2B 테이블 분리

| 테이블 | B2C | B2B | 정책 |
|--------|-----|-----|------|
| Contact | ✅ CRM 관리 | ✅ CRM 관리 | 같은 테이블 (channel으로 구분) |
| AffiliateSale | ❌ 크루즈닷몰 읽기전용 | ❌ 크루즈닷몰 읽기전용 | 공유 DB (수당 추적용) |
| PayAppPayment | ❌ | ✅ CRM 관리 | 분리됨 (B2B 전용) |
| CruiseProduct | ❌ 크루즈닷몰 읽기 | ❌ 크루즈닷몰 읽기 | 공유 DB (purchase 웹훅으로 자동생성) |

**결론:** ✅ **원칙 준수** — 크루즈닷몰 공유 테이블은 upsert만 (overage 안함)

---

### 5. 민감정보 로깅

| 파일 | 마스킹 | 문제점 |
|------|--------|--------|
| purchase | phone.substring(0, 4) + '***' | ✅ OK |
| refund | buyerPhone.slice(0, 4) + '***' | ✅ OK |
| payapp | phone.slice(0, 4) + '***' | ✅ OK |
| contract-signed | 로깅 없음 | ✅ OK (개인정보 없음) |

**결론:** ✅ **양호** — 전화번호 마스킹 일관됨

---

### 6. Origin 검증

| 웹훅 | Origin 검증 | 문제점 |
|------|-----------|--------|
| 모든 웹훅 | ❌ 없음 | 🔴 **DNS Rebinding 공격 가능** |

**발견:** 🔴 **DNS Rebinding 방어 필요**
```typescript
// 권장 추가 검증
const origin = req.headers.get('origin');
const host = req.headers.get('host');
const allowedOrigins = [
  'https://cruisedot.co.kr',
  'https://api.cruisedot.co.kr',
  'https://payapp.example.com'
];
if (!allowedOrigins.includes(origin)) {
  return NextResponse.json({ ok: false }, { status: 403 });
}
```

---

### 7. 응답 정보 공개

| 웹훅 | 응답 메시지 | 문제점 |
|------|-----------|--------|
| purchase | "조직 특정 불가", "중복 orderId" | ⚠️ 정보 공개 |
| refund | "조직 특정 불가", "Contact 찾을 수 없음" | ⚠️ 정보 공개 |
| payapp | "linkval 불일치 — 차단" | ✅ 일반적 메시지 |

**개선 권장:**
```typescript
// Before: 정보 공개
if (!organizationId) {
  return NextResponse.json({ ok: false, message: 'affiliateCode에 매핑된 조직 없음' }, { status: 422 });
}

// After: 일반적 메시지
if (!organizationId) {
  logger.warn('[...] 조직 특정 불가', { affiliateCode }); // 로그에만 기록
  return NextResponse.json({ ok: false }, { status: 422 }); // 응답은 일반적
}
```

---

## 양방향 동기화 문제점

### 현재 아키텍처: 크루즈닷몰 → CRM (단방향)

```
크루즈닷몰 [Event 발생]
    ↓
CRM [수신해서 기록]
    ↓
CRM Local DB 업데이트 완료
    ↓
❌ 크루즈닷몰에 역보고 없음
```

### 식별된 문제점

#### 1. Contact 정보 변경 시 역동기화 부족

**시나리오:**
```
CRM에서: Contact 이름 "김철수" → "김철순" 변경
크루즈닷몰: 여전히 "김철수" 유지 ← 불일치
```

**영향:**
- 데이터 불일치 누적
- 나중에 새 구매 시 어느 정보를 우선할지 불명확
- 고객 이름 확인 시 혼란

**해결책:**
- ✅ PUT /api/contacts/[id] 웹훅 구현 필요
- ✅ 선택적 동기화 (변경 필드만)
- ✅ 충돌 해결 전략 (Last-Write-Wins vs CRM 우선)

---

#### 2. 상품 정보 변경 시 일관성 부족

**시나리오:**
```
크루즈닷몰: 상품 가격 "3,500,000원" → "3,800,000원"
CRM: 기존 "3,500,000원" 그대로 ← 이미 구매한 주문 가격만 저장됨

새 고객 구매 시:
  - purchase 웹훅에서 "3,800,000원" 받음 → 추가 가격 혼란
```

**해결책:**
- ✅ POST /api/webhooks/product 웹훅 구현 (이미 요청됨)
- ✅ 상품 버전 관리 (productCode + startDate로 버전 구분)
- ✅ 가격 변경 알림 (대시보드에 표시)

---

#### 3. 환불 상태 동기화 지연

**문제:**
```
크루즈닷몰: 환불 승인 완료
CRM 웹훅: 30초 후 수신 → Contact type 변경
사용자가 그 사이에 조회 → 아직 CUSTOMER로 보임
```

**해결책:**
- 🔴 **실시간 동기화 불가능** (웹훅 레이턴시)
- ✅ **CRM 조회 시 크루즈닷몰 API 호출** (Single Source of Truth)
- ✅ **캐시 + TTL** (예: 5분 캐시)

---

#### 4. AffiliateSale 수당 계산 오류 위험

**문제:**
```
1단계 웹훅: commissionRate=null (관리자 승인 전)
   → AffiliateSale 생성 (commission=0)

2단계 웹훅: commissionRate=5.0 (승인됨)
   → AffiliateSale 업데이트 (commission=175,000)

그 사이 누군가 "수당 조회" → 0원으로 보임 ← 일시적 오류
```

**해결책:**
- ✅ 현재는 upsert로 업데이트하므로 최종적으로 OK
- ⚠️ **UI는 1단계 commission=null을 명시적으로 표시** (대기중)
- ✅ **조회 시 캐시 5분 이상** (자주 바뀌지 않음)

---

### 권장 동기화 전략

```
┌─────────────────────────────────────────────┐
│   Event-Driven (현재) + Periodic Sync (신규) │
├─────────────────────────────────────────────┤
│                                             │
│  1. 웹훅 (이벤트 기반) — 빠른 응답           │
│     - purchase, refund, lead-status 등     │
│     - SLA: <1초                            │
│                                             │
│  2. Cron (시간 기반) — 누락 복구            │
│     - 1시간마다 Contact/Product 동기화     │
│     - DLQ 재시도                           │
│     - 기차단된 웹훅 복구                   │
│                                             │
│  3. API 폴링 (필요 시) — 정합성 확보       │
│     - CRM 조회 시 크루즈닷몰 API 호출     │
│     - 5분 캐시                             │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 성능 & 지연 문제

### 1. N+1 쿼리 문제

**웹훅 처리 중 N+1 발생 지점:**

| 웹훅 | 쿼리 | 문제 | 해결 |
|------|------|------|------|
| purchase | organizationId 찾기 (AffiliateSale → Contact → DEFAULT) | ✅ 3쿼리 고정 | orderBy + limit 1 |
| lead-status | affiliateCode → Contact (N명) | ⚠️ N+1 가능 | findFirst + orderBy limit 1 |
| contract-signed | Organization 조회 | ✅ 1쿼리 | OK |

**발견:** 🟡 **lead-status: Contact 찾기가 최악의 경우 N명**

```typescript
// 현재 코드 (개선 필요)
contact = await prisma.contact.findFirst({
  where: { affiliateCode, organizationId },
  select: { id: true },
  orderBy: { createdAt: 'desc' }, // ← 모든 레코드 정렬 후 첫 개 선택
});

// 개선 권장
contact = await prisma.contact.findFirst({
  where: { affiliateCode, organizationId },
  select: { id: true },
  orderBy: { createdAt: 'desc' },
  take: 1, // ← explicit limit
});
```

### 2. 트랜잭션 시간

**평균 처리 시간 (예상):**

| 웹훅 | 쿼리 수 | DB 시간 | 네트워크 | 총합 |
|------|--------|--------|--------|------|
| purchase | 8-10 | 150ms | 100ms | ~300ms |
| refund | 6 | 120ms | 100ms | ~250ms |
| payapp | 4-5 | 100ms | 50ms | ~200ms |
| execution-status | 3 | 80ms | 50ms | ~150ms |

**문제점:** 🔴 **트랜잭션 길수록 Lock 시간 증가**

---

### 3. 멀티플 웹훅 동시 처리

**시나리오:**
```
2026-06-15 10:00:00 고객 A: purchase 웹훅 시작
2026-06-15 10:00:01 고객 B: purchase 웹훅 시작 ← 고객 A가 Contact Lock 중일 수 있음
```

**영향:**
- Lock wait timeout 가능성
- 전체 처리 시간 지연
- 동시성 1000+일 때 Deadlock 위험

**해결책:**
- ✅ **Batch Processing** (번들링)
- ✅ **Queue 기반 처리** (Message Queue)
- ✅ **DB Connection Pool 확대**
- ✅ **읽기 전용 레플리카** (조회 쿼리만)

---

## 권장 개선 사항

### Phase 3 (단기: 1-2주)

#### P0 (Critical)

1. **Cron 작업: DLQ 재시도 구현**
   - 파일: `src/app/api/cron/retry-dlq/route.ts` (미구현)
   - 일정: 5분마다
   - 처리: getPendingDLQEntries → 웹훅 재시도 → resolveDLQ/failDLQ
   - 예상 시간: 2시간

2. **cruise-purchase TOCTOU 취약점 수정**
   - 파일: `src/app/api/webhooks/cruise-purchase/route.ts`
   - 변경: findUnique 체크 → create (실패 시 catch로 중복 처리)
   - 예상 시간: 30분

3. **purchase 웹훅 입력값 검증 강화**
   - saleAmount 범위 체크 추가 (0~100,000,000)
   - 예상 시간: 30분

#### P1 (High)

4. **POST /api/webhooks/product (상품 마스터) 구현**
   - 파일: `src/app/api/webhooks/product/route.ts` (신규)
   - 요청: mabiz 협의 필요 (2026-05-16 요청됨)
   - 처리: CruiseProduct upsert + RefundPolicy 저장
   - 예상 시간: 4시간
   - 블로킹: 크루즈닷몰 웹훅 URL 설정 필요

5. **Origin 검증 추가 (DNS Rebinding 방어)**
   - 모든 웹훅에 추가
   - 예상 시간: 1시간

6. **응답 메시지 일반화 (정보공개 감소)**
   - 모든 웹훅 4xx 응답 표준화
   - 예상 시간: 1시간

---

### Phase 4 (중기: 2-4주)

#### P1 (High)

7. **모니터링 대시보드 추가**
   - DLQ 상태 표시
   - 웹훅 처리 통계 (성공율, 평균시간)
   - 파일: `src/app/(admin)/monitoring/webhooks/page.tsx` (신규)
   - 예상 시간: 6시간

8. **양방향 Contact 동기화 (Optional)**
   - CRM Contact 변경 → 크루즈닷몰 API PUT
   - 파일: `src/lib/sync/contact-sync.ts` (신규)
   - 예상 시간: 8시간
   - 우선순위: 🟡 P2 (낮음)

#### P2 (Medium)

9. **성능 최적화: 배치 처리**
   - 같은 organizationId의 웹훅 번들링
   - 파일: `src/lib/services/webhook-batcher.ts` (신규)
   - 예상 시간: 6시간

10. **환불 역동기화 (Optional)**
    - 환불취소 → 크루즈닷몰 알림
    - 파일: `src/lib/sync/refund-sync.ts` (신규)
    - 우선순위: 🟢 P3 (매우 낮음)

---

### 우선순위 로드맵

```
Week 1 (P0 집중)
├─ DLQ Cron 구현 (2h) ✅
├─ cruise-purchase TOCTOU 수정 (0.5h) ✅
├─ purchase 입력값 검증 (0.5h) ✅
└─ Origin 검증 (1h) ✅

Week 2 (P1)
├─ product 웹훅 구현 (4h) ⏳ (크루즈닷몰 협의 필요)
├─ 응답 메시지 표준화 (1h) ✅
└─ 모니터링 대시보드 (6h) ⏳

Week 3-4 (P2)
├─ 배치 처리 (6h)
└─ Contact 양방향 동기화 (8h)

Month 2+ (P3)
└─ 환불 역동기화, 재고 동기화 등
```

---

## 요약표

### 웹훅 성숙도 (Maturity Matrix)

```
                  구현  멱등성  보안  모니터링  재시도  양방향  성능최적화
purchase          ✅    ✅     ✅    🟡       ✅    ❌     🟡
refund            ✅    ✅     ✅    🟡       ✅    ❌     🟡
cruise-purchase   ✅    ⚠️     ✅    🟡       ✅    ❌     🟡
contract-signed   ✅    ✅     ✅    🟡       ✅    ❌     ✅
lead-status       ✅    ✅     ✅    🟡       ✅    ❌     ⚠️
execution-status  ✅    ✅     ✅    🟡       ✅    N/A    ✅
payapp            ✅    ✅     ✅    🟡       🟡    ❌     🟡
product           ❌    N/A    N/A   N/A      N/A   N/A    N/A
contact-sync      ❌    N/A    N/A   N/A      N/A   N/A    N/A
refund-reversal   ❌    N/A    N/A   N/A      N/A   N/A    N/A

범례:
✅ 완료  🟡 부분완료  ⚠️ 주의  ❌ 미구현  N/A 해당없음
```

---

## 결론

### 현재 상태

- ✅ **Phase 1-2 완료:** 핵심 웹훅 (purchase, refund, contract-signed, lead-status) 구현됨
- ✅ **DLQ 기반 구조:** 3회 재시도 (5m, 15m, 60m) 설계 완료
- ✅ **보안 기초:** HMAC, Bearer Token, 멱등성 처리 모두 구현됨
- 🟡 **모니터링 부족:** DLQ 상태 대시보드 없음
- 🟡 **양방향 동기화 부족:** Contact/Product 역동기화 미구현
- 🟡 **성능 최적화 필요:** 동시 처리 시 Lock 문제 가능성

### 다음 액션

**1주일 (P0):**
- [ ] DLQ Cron 재시도 구현
- [ ] cruise-purchase TOCTOU 수정
- [ ] 입력값 검증 강화

**2주일 (P1):**
- [ ] POST /webhooks/product 구현 (크루즈닷몰 협의)
- [ ] 모니터링 대시보드
- [ ] Origin 검증

**3주일+ (P2):**
- [ ] 배치 처리/성능 최적화
- [ ] 양방향 동기화 (선택사항)

---

**첨부:**
- 웹훅 페이로드 스펙: `MABIZ_PRODUCT_WEBHOOK_REQUEST.md`
- DLQ 코드: `src/lib/mabiz-dlq.ts`
- 보안 검증: `src/lib/webhook-verify.ts`
- 실행 로직: `src/lib/webhook-execution.ts`
