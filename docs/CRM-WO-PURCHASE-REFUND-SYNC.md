# [크루즈닷몰 → CRM 작업지시서] 결제자·환불자 연동 완성

**전달일**: 2026-05-11  
**작성**: 크루즈닷몰 개발팀  
**수신**: mabiz CRM 개발팀  
**긴급도**: P1 — 현재 환불 webhook이 400 에러로 실패 중 (buyerPhone 미전송 버그 수정됨)

---

## 📌 현재 상태 요약

| 항목 | 현재 상태 | 이번 변경 후 |
|------|-----------|------------|
| 결제 → CRM | phone, name, productName, orderId, affiliateCode 전송 | + saleId, amount, customerEmail, productCode, headcount 추가 |
| 환불 → CRM | buyerPhone **미전송** → CRM 400 에러 발생 중 | buyerPhone 전송 시작 (마스킹: `010-****-1234`) |

---

## 🔴 긴급: 환불 webhook 필드명 불일치 수정

### 문제
크루즈닷몰이 `amount`로 보내는데, CRM `/api/webhooks/refund`는 `refundAmount`를 읽음.  
**현재 CRM이 환불금액을 못 받고 있음.**

### CRM 수정 위치
**파일**: `src/app/api/webhooks/refund/route.ts`

**현재 코드** (L34~L44):
```typescript
const body = await req.json() as {
  orderId: string;
  buyerPhone: string;
  buyerName?: string;
  refundAmount: number;   // ← 크루즈닷몰은 "amount"로 보냄
  refundedAt: string;
  organizationId?: string;
  eventId?: string;
};

const { orderId, buyerPhone, organizationId: bodyOrgId, eventId } = body;
```

**수정 코드**:
```typescript
const body = await req.json() as {
  orderId: string;
  buyerPhone?: string | null;  // 마스킹된 값 (010-****-1234), 없을 수도 있음
  buyerName?: string;
  amount?: number;             // 크루즈닷몰이 "amount"로 전송
  refundAmount?: number;       // 하위호환 (기존 클라이언트 대비)
  reason?: string;             // 환불 사유
  saleId?: number | null;      // 크루즈닷몰 AffiliateSale ID
  refundedAt: string;
  organizationId?: string;
  eventId?: string;
};

// amount / refundAmount 둘 다 허용 (하위호환)
const refundAmount = body.amount ?? body.refundAmount ?? 0;
const { orderId, buyerPhone, organizationId: bodyOrgId, eventId } = body;
```

> ⚠️ `buyerPhone` 필수 → 선택으로 변경 이유:  
> 크루즈닷몰이 buyerPhone을 조회 실패 시 null로 보낼 수 있음. 필수 체크 제거 또는 null 허용 처리 필요.

**현재 필수 체크 수정** (L46):
```typescript
// 기존
if (!orderId || !buyerPhone) { ... }

// 수정 — buyerPhone은 선택사항으로 변경
if (!orderId) { ... }
```

---

## 🟡 결제 webhook — 신규 필드 처리

### 크루즈닷몰이 이제 보내는 필드

**엔드포인트**: `MABIZ_PURCHASE_WEBHOOK_URL` (환경변수로 설정된 URL)

**추가된 필드 (전체 payload)**:
```typescript
{
  // 기존 필드
  phone: string;           // 구매자 전화번호
  name: string;            // 구매자 이름
  productName?: string;    // 상품명
  departureDate?: string;  // 출발일 (YYYY-MM-DD)
  orderId?: string;        // 주문번호 (중복 방지 키)
  affiliateCode?: string;  // 파트너 코드
  cabinType?: string;      // 캐빈 타입

  // ✨ 신규 추가 필드
  saleId?: number | null;        // 크루즈닷몰 AffiliateSale ID (크로스 레퍼런스용)
  amount?: number | null;        // 결제금액 (원)
  customerEmail?: string | null; // 이메일 (없으면 null)
  productCode?: string | null;   // 상품코드 (ex: "CRUISE_2026_MAY")
  headcount?: number | null;     // 예약 인원수

  eventId: string;               // 멱등성 키 (기존)
}
```

### CRM에서 처리할 것

**파일**: `src/app/api/webhooks/purchase/route.ts` 또는 `cruise-purchase/route.ts`  
(어느 파일이 `MABIZ_PURCHASE_WEBHOOK_URL`에 연결되어 있는지 확인 후 수정)

**추가할 처리 로직**:

```typescript
// 신규 필드 destructure 추가
const {
  phone, name, productName, departureDate, orderId, affiliateCode,
  // 신규
  saleId,
  amount,
  customerEmail,
  productCode,
  headcount,
  eventId,
} = body;

// Contact upsert에 email 추가
await tx.contact.upsert({
  ...
  create: {
    phone: normalizedPhone,
    name,
    email: customerEmail ?? null,   // ← 추가
    productName: productName ?? null,
    departureDate: departureDate ? new Date(departureDate) : null,
    bookingRef: orderId ?? null,
    affiliateCode: affiliateCode ?? null,
    purchasedAt: new Date(),
  },
  update: {
    name,
    email: customerEmail ?? undefined,  // ← 추가 (null이면 덮어쓰지 않음)
    productName: productName ?? undefined,
    ...
  },
});
```

> `email` 컬럼이 Contact 테이블에 없으면 스키마 추가 필요 (CRM 팀 판단)

---

## 🟢 환불 webhook — 신규 필드 처리 (buyerPhone)

### 크루즈닷몰이 이제 보내는 필드

```typescript
{
  orderId: string;             // 주문번호
  saleId?: number | null;      // 크루즈닷몰 AffiliateSale ID
  amount: number;              // 환불금액 (기존 refundAmount → amount로 변경)
  reason?: string;             // 환불 사유
  refundedAt: string;          // ISO timestamp
  buyerPhone?: string | null;  // ✨ 신규: 마스킹된 구매자 전화번호 (010-****-1234)
  eventId: string;             // 멱등성 키
}
```

### buyerPhone 활용 방법

`buyerPhone`은 마스킹된 값(`010-****-1234`)이므로 **Contact 조회에 직접 사용 불가**.  
용도: CRM 화면에서 "어떤 고객이 환불됐는지" 담당자가 육안 확인용으로만 사용.

```typescript
// 환불 처리 후 로그/메모에 표시
logger.log('[RefundWebhook] 환불 고객', {
  orderId,
  buyerPhone: buyerPhone ?? '번호 없음',  // 마스킹된 값 그대로 로그
  refundedAt,
});
```

> ⚠️ `normalizePhone(buyerPhone)`으로 정규화 시도하지 말 것 — 마스킹 문자(`*`) 포함이라 정규화 불가.  
> Contact 조회는 `orderId`로만 할 것.

---

## 🔵 크로스 레퍼런스 — saleId 활용 (선택 사항)

결제/환불 모두 `saleId`(크루즈닷몰 내부 AffiliateSale ID)를 전송합니다.

활용 예시:
```typescript
// AffiliateSale 기록 시 크루즈닷몰 saleId 저장
await tx.affiliateSale.create({
  data: {
    ...
    cruiseSaleId: saleId ?? null,  // 크루즈닷몰 AffiliateSale.id
  }
});
```

> `cruiseSaleId` 컬럼이 없으면 추가하거나, 기존 `metadata` JSON 필드에 저장해도 됨.

---

## ✅ 수정 우선순위

| 우선순위 | 파일 | 내용 |
|---------|------|------|
| **P0 (즉시)** | `webhooks/refund/route.ts` | `refundAmount` → `amount` 필드명 수정, `buyerPhone` 선택사항으로 변경 |
| **P1** | `webhooks/purchase/route.ts` 또는 `cruise-purchase/route.ts` | `customerEmail`, `saleId`, `amount`, `headcount` 신규 필드 처리 |
| **P2 (선택)** | Contact 스키마 | `email` 컬럼 추가 (없는 경우) |
| **P2 (선택)** | AffiliateSale 스키마 | `cruiseSaleId` 컬럼 추가 (크로스레퍼런스) |

---

## 📞 확인 필요 사항

크루즈닷몰 → CRM 결제 webhook 연결이  
`/api/webhooks/purchase` 와 `/api/webhooks/cruise-purchase` 중  
**어느 엔드포인트로 설정되어 있는지 CRM팀이 `.env`의 `MABIZ_PURCHASE_WEBHOOK_URL` 확인 필요.**

두 엔드포인트의 필드명이 다릅니다:
- `/purchase`: `phone`, `name` 사용
- `/cruise-purchase`: `buyerTel`, `buyerName` 사용

크루즈닷몰은 `phone`, `name`으로 전송합니다.
