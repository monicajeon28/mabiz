# 신뢰도 시스템 API 스펙 (초등학생 수준)

**작성일**: 2026-06-19  
**상태**: 설계 완료  
**구현 순서**: 1. DB 타입 정의 → 2. API 생성 → 3. UI 연결

---

## 📚 목차
1. [개념 설명 (쉬운 버전)](#개념-설명)
2. [DB 타입 정의](#db-타입-정의)
3. [API 스펙 (6개)](#api-스펙)
4. [자동 트리거](#자동-트리거)
5. [구현 체크리스트](#구현-체크리스트)

---

## 개념 설명

### 신뢰도란?
신뢰도는 **판매원이 얼마나 믿을 수 있는지 점수를 매기는 것**입니다.

```
신뢰도 점수 (0-100)
↓
환불율 계산 (몇 % 환불됐는가)
↓
상태 결정 (좋음/경고/제한/정지)
```

### 예시 (아주 쉬운 버전)
```
김철수 판매원
- 100명 판매
- 30명 환불
→ 환불율: 30%
→ 신뢰도: 70점
→ 상태: WARNING (경고)
```

---

## DB 타입 정의

### 1️⃣ TrustScore 테이블

```prisma
model TrustScore {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // 환불 통계
  totalSales      Int       @default(0)     // 총 판매건수
  totalRefunds    Int       @default(0)     // 총 환불건수
  refundRate      Float     @default(0)     // 환불율 (%)
  
  // 신뢰도 점수
  trustScore      Int       @default(100)   // 0-100 점수
  status          String    @default("GOOD") // GOOD / WARNING / RESTRICTED / SUSPENDED
  
  // 임계값 추적
  nextThreshold   Int       @default(35)    // 다음 상태까지 남은 환불율
  warningCount    Int       @default(0)     // 경고 받은 횟수
  
  // 타임스탬프
  lastCalculatedAt DateTime  @updatedAt
  statusChangedAt DateTime?  // 상태가 마지막으로 변경된 시간
  
  // 관계
  appeals         TrustAppeal[]
  
  @@index([userId])
  @@index([status])
}
```

### 2️⃣ TrustAppeal 테이블 (이의 제기)

```prisma
model TrustAppeal {
  id              String    @id @default(cuid())
  trustScoreId    String
  trustScore      TrustScore @relation(fields: [trustScoreId], references: [id], onDelete: Cascade)
  
  // 이의 내용
  reason          String    // "상품 하자", "고객 요청" 등
  evidenceUrls    String[]  @default([]) // 증거 URL 배열
  
  // 상태
  status          String    @default("PENDING") // PENDING / APPROVED / REJECTED
  adminReview     String?   // 관리자 검토 의견
  
  // 결과
  requestedAction String?   // "RESTORE" 등 원하는 조치
  appliedAction   String?   // 실제 적용된 조치
  
  // 타임스탬프
  createdAt       DateTime  @default(now())
  reviewedAt      DateTime?
  reviewedBy      String?   // 관리자 ID
  
  @@index([status])
  @@index([trustScoreId])
}
```

### 3️⃣ TrustAuditLog 테이블 (기록)

```prisma
model TrustAuditLog {
  id              String    @id @default(cuid())
  userId          String
  
  // 변경 내용
  eventType       String    // "REFUND", "STATUS_CHANGE", "APPEAL", "ADMIN_ACTION"
  previousValue   Json?     // 이전 값
  newValue        Json?     // 새로운 값
  
  // 설명
  description     String    // "환불 1건 처리됨" 등
  
  // 누가 했는가
  triggeredBy     String?   // 시스템 또는 사용자 ID
  
  // 타임스탬프
  createdAt       DateTime  @default(now())
  
  @@index([userId])
  @@index([eventType])
}
```

---

## API 스펙

### 🔵 API 1: 신뢰도 조회
```
GET /api/trust-score/{userId}
```

**누가 써?**
- 판매원: 자신의 신뢰도 확인
- 관리자: 누구든지 조회

**요청 본문**
```javascript
// 경로 변수
{
  userId: "user_123"  // 누가의 신뢰도?
}
```

**성공 응답 (200)**
```json
{
  "id": "trust_abc123",
  "userId": "user_123",
  "refundRate": 32,
  "trustScore": 68,
  "status": "WARNING",
  "nextThreshold": 35,
  "warningCount": 2,
  "message": "환불이 많아졌어요. 조금 더 신경 써주세요.",
  "lastCalculatedAt": "2026-06-19T10:30:00Z"
}
```

**설명**
| 필드 | 의미 | 예시 |
|------|------|------|
| refundRate | 환불율 (%) | 32 = 32% 환불 |
| trustScore | 신뢰도 점수 | 68 = 68점 |
| status | 상태 | WARNING = 경고 상태 |
| nextThreshold | 다음 단계까지 | 35 = 35% 되면 제한됨 |
| message | 판매원에게 보여주는 메시지 | "조금 더 신경 써주세요" |

**에러 응답**
```json
{
  "error": "사용자를 찾을 수 없습니다",
  "code": "USER_NOT_FOUND"
}
```

---

### 🔵 API 2: 신뢰도 계산 (자동)
```
POST /api/trust-score/{userId}/calculate
```

**누가 써?**
- 시스템 자동 (환불 처리 후)
- 관리자 수동 재계산

**요청 본문**
```javascript
{
  force: false  // true = 강제 재계산
}
```

**내부 로직**
```
1. userId로 모든 거래 조회
2. 환불 건수 세기
   totalRefunds = 환불된 거래 수
   totalSales = 전체 거래 수
3. 환불율 계산
   refundRate = (totalRefunds / totalSales) * 100
4. 신뢰도 점수 계산
   trustScore = 100 - refundRate
5. 상태 결정
   if refundRate < 30% → GOOD
   if 30% ≤ refundRate < 35% → WARNING
   if 35% ≤ refundRate < 40% → RESTRICTED
   if refundRate ≥ 40% → SUSPENDED
6. 상태 변경 감지
   if 상태가 바뀌었다면 → TrustAuditLog 기록
   if 상태가 바뀌었다면 → 알림 발송
```

**성공 응답 (200)**
```json
{
  "id": "trust_abc123",
  "userId": "user_123",
  "refundRate": 28,
  "trustScore": 72,
  "status": "GOOD",
  "nextThreshold": 30,
  "message": "훌륭해요! 계속 잘해주세요.",
  "statusChanged": false,
  "previousStatus": "GOOD"
}
```

**변경 예시**
```json
{
  "statusChanged": true,
  "previousStatus": "GOOD",
  "status": "WARNING",
  "notification": {
    "type": "WARNING",
    "message": "경고: 환불율이 30%를 넘었습니다."
  }
}
```

---

### 🔵 API 3: 상태 변경 (관리자만)
```
PATCH /api/trust-score/{userId}/status
```

**누가 써?**
- 관리자만

**요청 본문**
```javascript
{
  status: "SUSPENDED",      // 새로운 상태
  reason: "반복적 부정행위",  // 왜?
  note: "2주간 정지"         // 추가 설명
}
```

**유효한 상태**
- `GOOD`: 정상
- `WARNING`: 경고
- `RESTRICTED`: 판매 불가능
- `SUSPENDED`: 로그인 차단

**성공 응답 (200)**
```json
{
  "id": "trust_abc123",
  "userId": "user_123",
  "status": "SUSPENDED",
  "reason": "반복적 부정행위",
  "changedAt": "2026-06-19T10:30:00Z",
  "changedBy": "admin_456"
}
```

**자동 조치**
- SUSPENDED → 로그인 차단 (다음 로그인 시)
- RESTRICTED → 새 상품 등록 차단
- WARNING → 대시보드에 경고 표시

---

### 🔵 API 4: 이의 제기
```
POST /api/trust-score/{userId}/appeal
```

**누가 써?**
- 판매원 (자신의 신뢰도 낮아졌을 때)

**요청 본문**
```javascript
{
  reason: "상품 하자로 반품",  // 이유
  evidenceUrls: [
    "https://drive.google.com/file/...",
    "https://drive.google.com/file/..."
  ],
  requestedAction: "RESTORE"  // "RESTORE" = 환불 원인 제거
}
```

**이유 선택지** (초등학생 수준)
- `PRODUCT_DEFECT`: 상품이 나빴어요
- `CUSTOMER_REQUESTED`: 고객이 환불해달라고 했어요
- `LOGISTICS_ERROR`: 배송 문제였어요
- `MISUNDERSTANDING`: 착오가 있었어요
- `SPECIAL_REQUEST`: 특별한 사정이 있었어요

**증거 자료**
- Google Drive 파일 링크
- 메시지 스크린샷
- 이메일 증명

**성공 응답 (201)**
```json
{
  "id": "appeal_xyz789",
  "userId": "user_123",
  "trustScoreId": "trust_abc123",
  "status": "PENDING",
  "reason": "상품 하자로 반품",
  "evidenceCount": 2,
  "requestedAction": "RESTORE",
  "createdAt": "2026-06-19T10:30:00Z",
  "message": "이의 제기가 접수되었습니다. 관리자가 검토 후 연락드리겠습니다."
}
```

---

### 🔵 API 5: 이의 제기 검토 (관리자만)
```
PATCH /api/trust-score/appeal/{appealId}/review
```

**누가 써?**
- 관리자만

**요청 본문 (승인)**
```javascript
{
  status: "APPROVED",
  adminReview: "증거자료 확인됨. 환불 정당함.",
  appliedAction: "RESTORE",
  trustScoreAdjustment: -1  // 신뢰도 -1 건만 제거
}
```

**요청 본문 (거부)**
```javascript
{
  status: "REJECTED",
  adminReview: "증거가 부족합니다.",
  appliedAction: null
}
```

**성공 응답 (200)**
```json
{
  "id": "appeal_xyz789",
  "status": "APPROVED",
  "adminReview": "증거자료 확인됨. 환불 정당함.",
  "appliedAction": "RESTORE",
  "reviewedAt": "2026-06-19T10:35:00Z",
  "reviewedBy": "admin_456",
  "result": {
    "trustScoreUpdated": true,
    "previousScore": 68,
    "newScore": 70,
    "previousRefundRate": 32,
    "newRefundRate": 31
  }
}
```

---

### 🔵 API 6: 신뢰도 기록 조회
```
GET /api/trust-score/{userId}/audit-logs
```

**누가 써?**
- 본인: 자신의 기록
- 관리자: 누구든지

**쿼리 파라미터**
```javascript
{
  limit: 50,           // 몇 개 보기?
  offset: 0,           // 몇 번째부터?
  eventType: "REFUND"  // (옵션) 필터
}
```

**성공 응답 (200)**
```json
{
  "total": 45,
  "logs": [
    {
      "id": "log_1",
      "eventType": "REFUND",
      "description": "환불 1건 처리됨 (주문 #12345)",
      "previousValue": {
        "refundRate": 31,
        "trustScore": 69
      },
      "newValue": {
        "refundRate": 32,
        "trustScore": 68
      },
      "triggeredBy": "system",
      "createdAt": "2026-06-19T10:30:00Z"
    },
    {
      "id": "log_2",
      "eventType": "STATUS_CHANGE",
      "description": "상태 변경됨: GOOD → WARNING",
      "previousValue": {
        "status": "GOOD"
      },
      "newValue": {
        "status": "WARNING"
      },
      "triggeredBy": "system",
      "createdAt": "2026-06-19T10:30:05Z"
    },
    {
      "id": "log_3",
      "eventType": "APPEAL_APPROVED",
      "description": "이의 제기 승인됨",
      "previousValue": {
        "refundRate": 32,
        "trustScore": 68
      },
      "newValue": {
        "refundRate": 31,
        "trustScore": 69
      },
      "triggeredBy": "admin_456",
      "createdAt": "2026-06-19T10:35:00Z"
    }
  ]
}
```

---

## 자동 트리거

### 1️⃣ 환불 처리 후

```typescript
// payment.route.ts 에서 환불 처리 시

POST /api/refunds

↓ (환불 저장)

// 자동 트리거
await calculateTrustScore(userId);

↓ (신뢰도 재계산)

// 상태 변경 감지
if (newStatus !== oldStatus) {
  await createAuditLog({...});
  await sendNotification(userId, {
    title: "신뢰도 상태 변경",
    message: `${oldStatus} → ${newStatus}`
  });
}
```

### 2️⃣ 일일 정시 계산

```typescript
// cron/daily-trust-score-calculation.mjs

실행: 매일 오전 2:00 (UTC)

모든 사용자 순회:
- 환불율 재계산
- 상태 변경 감지
- 필요시 알림 발송
- 로그 기록
```

### 3️⃣ 이의 제기 승인 후

```typescript
PATCH /api/trust-score/appeal/{appealId}/review

↓ (승인 처리)

// 자동 트리거
if (appliedAction === "RESTORE") {
  // 환불 1건만 제거하여 재계산
  await removeRefundRecord(refundId);
  await calculateTrustScore(userId);
}
```

---

## 초등학생 수준 설명

### 신뢰도 상태 의미

```
┌─────────────────────────────────────┐
│ GOOD (좋음)                         │
│ 환불율 < 30%                       │
│ ✅ 모든 기능 사용 가능              │
│ 💬 "훌륭해요! 계속 잘해주세요"    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ WARNING (경고)                      │
│ 환불율 30% ~ 35%                  │
│ ⚠️ 판매 가능, 경고 표시             │
│ 💬 "조금 더 신경 써주세요"         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ RESTRICTED (제한)                  │
│ 환불율 35% ~ 40%                  │
│ 🚫 새 상품 등록 불가               │
│ 🔧 기존 상품 관리만 가능            │
│ 💬 "개선이 필요합니다"              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ SUSPENDED (정지)                    │
│ 환불율 ≥ 40%                       │
│ 🔒 로그인 차단                      │
│ 📞 관리자 연락 필요                 │
│ 💬 "일시 중지되었습니다"            │
└─────────────────────────────────────┘
```

---

## 구현 체크리스트

### Phase 1: 타입 정의
- [ ] `src/types/trust-score.ts` 생성
  ```typescript
  export interface TrustScore { ... }
  export interface TrustAppeal { ... }
  export interface TrustAuditLog { ... }
  ```

### Phase 2: Prisma 스키마
- [ ] `prisma/schema.prisma` 에 3개 모델 추가
- [ ] `npx prisma migrate dev --name add_trust_score`

### Phase 3: API 구현 (6개)
- [ ] `src/app/api/trust-score/[userId]/route.ts` (API 1: 조회)
- [ ] `src/app/api/trust-score/[userId]/calculate/route.ts` (API 2: 계산)
- [ ] `src/app/api/trust-score/[userId]/status/route.ts` (API 3: 상태변경)
- [ ] `src/app/api/trust-score/[userId]/appeal/route.ts` (API 4: 이의제기)
- [ ] `src/app/api/trust-score/appeal/[appealId]/review/route.ts` (API 5: 이의검토)
- [ ] `src/app/api/trust-score/[userId]/audit-logs/route.ts` (API 6: 기록조회)

### Phase 4: 자동 트리거
- [ ] 환불 API에 자동 계산 연결
- [ ] `src/app/api/cron/daily-trust-score-calculation.mjs` 생성
- [ ] 이의 제기 승인 후 자동 계산 연결

### Phase 5: UI 연결
- [ ] 대시보드: 신뢰도 카드 표시
- [ ] 설정 페이지: 상세 기록 조회
- [ ] 모달: 이의 제기 양식

### Phase 6: 검증
- [ ] `npx tsc --noEmit` (0 에러)
- [ ] 통합 테스트 (6가지 API 경로)
- [ ] 자동 트리거 테스트 (환불 → 신뢰도 변경)

---

## API 호출 예시 (JavaScript)

### 신뢰도 조회
```javascript
async function checkTrustScore(userId) {
  const res = await fetch(`/api/trust-score/${userId}`);
  const data = await res.json();
  
  console.log(`신뢰도: ${data.trustScore}점`);
  console.log(`상태: ${data.status}`);
  console.log(`메시지: ${data.message}`);
}
```

### 이의 제기
```javascript
async function submitAppeal(userId, reason, evidenceUrls) {
  const res = await fetch(`/api/trust-score/${userId}/appeal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reason,
      evidenceUrls,
      requestedAction: "RESTORE"
    })
  });
  
  const data = await res.json();
  console.log(`이의 제기 ID: ${data.id}`);
}
```

### 이의 제기 검토 (관리자)
```javascript
async function approveAppeal(appealId, reason) {
  const res = await fetch(
    `/api/trust-score/appeal/${appealId}/review`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "APPROVED",
        adminReview: reason,
        appliedAction: "RESTORE"
      })
    }
  );
  
  const data = await res.json();
  console.log(`승인됨. 신뢰도: ${data.result.newScore}점`);
}
```

---

**다음 단계**: Phase 1 (Prisma 스키마) 구현 시작
