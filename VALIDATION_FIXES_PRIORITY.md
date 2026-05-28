# P0 크리티컬 이슈 긴급 수정 가이드 (2026-05-28)

## 🚨 6가지 P0 이슈 즉시 수정 필요

### Issue #1: Settlement Webhook - Unsafe `any` Cast
**파일**: `src/app/api/webhooks/cruisedot-settlement/route.ts`

**현재 코드 (라인 131-138)**:
```typescript
commissionLedgerEntry = await tx.commissionLedger.create({
  data: {
    // ... 필드들
    metadata: {
      eventId,
      eventType,
      period,
      settlementStatus: status,
      paymentDate,
      commissionRate: finalCommissionRate,
    } as any,  // ❌ DANGEROUS
  },
});
```

**수정 코드**:
```typescript
interface SettlementMetadata {
  eventId: string;
  eventType: string;
  period: string;
  settlementStatus: string;
  paymentDate?: string;
  commissionRate: number;
}

commissionLedgerEntry = await tx.commissionLedger.create({
  data: {
    // ... 필드들
    metadata: {
      eventId,
      eventType,
      period,
      settlementStatus: status,
      paymentDate,
      commissionRate: finalCommissionRate,
    } as unknown as Record<string, any>,
  },
});
```

**테스트**:
```bash
npx tsc --noEmit src/app/api/webhooks/cruisedot-settlement/route.ts
```

---

### Issue #2: Settlement Webhook SettlementEvent - Unsafe `any` Cast
**파일**: `src/app/api/webhooks/cruisedot-settlement/route.ts`

**현재 코드 (라인 162-170)**:
```typescript
settlementEventEntry = await tx.settlementEvent.create({
  data: {
    // ...
    metadata: {
      eventId,
      eventType,
      partnerId: profileIdInt,
      amount,
      netAmount: calculatedNetAmount,
      commissionRate: finalCommissionRate,
      paymentDate,
    } as any,  // ❌ DANGEROUS
  },
});
```

**수정 코드**:
```typescript
interface SettlementEventMetadata {
  eventId: string;
  eventType: string;
  partnerId: number;
  amount: number;
  netAmount: number;
  commissionRate: number;
  paymentDate?: string;
}

settlementEventEntry = await tx.settlementEvent.create({
  data: {
    // ...
    metadata: {
      eventId,
      eventType,
      partnerId: profileIdInt,
      amount,
      netAmount: calculatedNetAmount,
      commissionRate: finalCommissionRate,
      paymentDate,
    } as unknown as Record<string, any>,
  },
});
```

---

### Issue #3: Payment Webhook - Untyped Contact Variable
**파일**: `src/app/api/webhooks/cruisedot-payment/route.ts`

**현재 코드 (라인 105-106)**:
```typescript
let contact: any = null;  // ❌ DANGEROUS
let shouldSendDay0Sms = false;
```

**수정 코드**:
```typescript
import type { Contact } from '@prisma/client';

interface ContactUpsertResult extends Partial<Contact> {
  id: string;
  organizationId: string;
  phone: string;
  userId?: string | null;
  name: string;
}

let contact: ContactUpsertResult | null = null;
let shouldSendDay0Sms = false;
```

**대체 방안** (Prisma select 사용):
```typescript
let contact: {
  id: string;
  organizationId: string;
  phone: string;
  userId: string | null;
  name: string;
} | null = null;

// ...

contact = await tx.contact.upsert({
  where: {
    bookingRef_organizationId: {
      bookingRef,
      organizationId: affiliateSale.organizationId,
    },
  },
  create: { /* ... */ },
  update: { /* ... */ },
  select: {
    id: true,
    organizationId: true,
    phone: true,
    userId: true,
    name: true,
  },
});
```

---

### Issue #4: Dashboard Stats - NaN/Infinity Risk
**파일**: `src/app/api/loop5/dashboard/stats/route.ts`

**현재 코드 (라인 44-50)**:
```typescript
const totalSent = smsLogs?.length || 0;
const totalClicked = campaignEvents?.filter(e => e.event_type === 'LINK_CLICKED').length || 0;
const totalFormSubmitted = campaignEvents?.filter(e => e.event_type === 'FORM_SUBMITTED').length || 0;

const responseRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
const formCompletionRate = totalClicked > 0 ? (totalFormSubmitted / totalClicked) * 100 : 0;
const estimatedRevenue = totalFormSubmitted * 8.25;  // ❌ undefined * number = NaN
```

**수정 코드**:
```typescript
const totalSent = smsLogs?.length ?? 0;
const totalClicked = campaignEvents
  ?.filter(e => e.event_type === 'LINK_CLICKED')
  ?.length ?? 0;
const totalFormSubmitted = campaignEvents
  ?.filter(e => e.event_type === 'FORM_SUBMITTED')
  ?.length ?? 0;

// Validate calculations
const responseRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
if (!isFinite(responseRate)) {
  logger.error('[Dashboard] Invalid responseRate calculation', {
    totalSent,
    totalClicked,
    responseRate,
  });
  // Fallback to 0
}

const formCompletionRate = totalClicked > 0 ? (totalFormSubmitted / totalClicked) * 100 : 0;
if (!isFinite(formCompletionRate)) {
  logger.error('[Dashboard] Invalid formCompletionRate calculation', {
    totalClicked,
    totalFormSubmitted,
    formCompletionRate,
  });
  // Fallback to 0
}

const estimatedRevenue = Math.max(0, (totalFormSubmitted ?? 0) * 8.25);
if (!isFinite(estimatedRevenue)) {
  logger.error('[Dashboard] Invalid revenue calculation', { totalFormSubmitted });
}
```

**테스트**:
```bash
# 테스트 케이스
curl "http://localhost:3000/api/loop5/dashboard/stats?fromDate=2026-05-01&toDate=2026-05-28"
# 응답이 NaN을 포함하지 않아야 함
```

---

### Issue #5: Settlement Webhook - Missing isNaN Check
**파일**: `src/app/api/webhooks/cruisedot-settlement/route.ts`

**현재 코드 (라인 99-106)**:
```typescript
const profileIdInt = parseInt(partnerId, 10);
const settlementIdInt = parseInt(settlementId, 10);

if (isNaN(profileIdInt)) {
  logger.warn('[SettlementWebhook] 유효하지 않은 partnerId', { partnerId });
  return NextResponse.json({ ok: false, message: '유효하지 않은 partnerId' }, { status: 400 });
}
// ❌ settlementIdInt에 대한 isNaN 체크 없음
```

**수정 코드**:
```typescript
const profileIdInt = parseInt(partnerId, 10);
const settlementIdInt = parseInt(settlementId, 10);

if (isNaN(profileIdInt) || profileIdInt <= 0) {
  logger.warn('[SettlementWebhook] 유효하지 않은 partnerId', { partnerId });
  return NextResponse.json({ ok: false, message: '유효하지 않은 partnerId' }, { status: 400 });
}

if (isNaN(settlementIdInt) || settlementIdInt <= 0) {
  logger.warn('[SettlementWebhook] 유효하지 않은 settlementId', { settlementId });
  return NextResponse.json({ ok: false, message: '유효하지 않은 settlementId' }, { status: 400 });
}
```

---

### Issue #6: A/B Test Dashboard - Empty Array Reduce
**파일**: `src/app/api/loop5/dashboard/ab-test-results/route.ts`

**현재 코드 (라인 97, 145)**:
```typescript
const winner = ctaTests.reduce((a: any, b: any) => a.rate > b.rate ? a : b);
// ❌ 빈 배열이면 에러: Reduce of empty array with no initial value

const best = dayTests.reduce((a: any, b: any) => a.rate > b.rate ? a : b, null);
// ⚠️ 초기값이 null인데 a.rate 접근 가능
```

**수정 코드**:
```typescript
// 옵션 1: Early return with empty check
if (ctaTests.length === 0) {
  logger.warn('[AB-Test] No CTA tests found');
  return NextResponse.json({
    ctaTests: [],
    winner: null,
    totalVariants: 0,
  });
}

const winner = ctaTests.reduce((a: CTA, b: CTA) => 
  a.rate > b.rate ? a : b
);

// 옵션 2: 안전한 reduce with default
const winner = ctaTests.length > 0
  ? ctaTests.reduce((a: CTA, b: CTA) => a.rate > b.rate ? a : b)
  : null;

const best = dayTests.length > 0
  ? dayTests.reduce((a: DayTest, b: DayTest) => a.rate > b.rate ? a : b)
  : null;
```

**Type 정의 추가**:
```typescript
interface CTA {
  id: string;
  version: string;
  rate: number;
  count: number;
}

interface DayTest {
  day: number;
  rate: number;
  count: number;
}
```

---

## 🔍 수정 검증 방법

### 1. TypeScript 타입 체크
```bash
# 전체 프로젝트
npx tsc --noEmit

# 특정 파일
npx tsc --noEmit src/app/api/webhooks/cruisedot-settlement/route.ts
npx tsc --noEmit src/app/api/loop5/dashboard/stats/route.ts
```

### 2. ESLint
```bash
npm run lint
# 또는
npx eslint "src/app/api/webhooks/*.ts" --fix
npx eslint "src/app/api/loop5/dashboard/*.ts" --fix
```

### 3. 런타임 테스트
```bash
# 로컬 개발 서버 시작
npm run dev

# 웹훅 테스트 (cURL)
curl -X POST http://localhost:3000/api/webhooks/cruisedot-settlement \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -H "x-signature: $(echo -n '{...}' | openssl dgst -sha256 -hmac 'secret' | cut -d' ' -f2)" \
  -d '{
    "eventId": "evt_test_123",
    "eventType": "settlement.paid",
    "timestamp": "2026-05-28T00:00:00Z",
    "settlementId": "1234",
    "partnerId": "5678",
    "period": "2026-05",
    "status": "PAID",
    "amount": 100000
  }'

# Dashboard 테스트
curl "http://localhost:3000/api/loop5/dashboard/stats?fromDate=2026-05-01&toDate=2026-05-28"
```

---

## 📝 커밋 메시지 템플릿

```
fix(webhooks): P0 Remove unsafe `any` casts in settlement handlers

- Replace `as any` with proper type definitions in CommissionLedger
- Replace `as any` with proper type definitions in SettlementEvent
- Add validation for settlementIdInt (missing isNaN check)
- Type ContactUpsertResult explicitly in payment webhook

Fixes: VALIDATION_REPORT_FINAL_B.md #1-5
```

```
fix(dashboard): P0 Handle NaN/Infinity in stats calculations

- Add ?? 0 coalescing for array length operations
- Add isFinite() validation for division results
- Add Math.max(0, ...) guard for revenue calculations
- Add error logging for invalid calculations

Fixes: VALIDATION_REPORT_FINAL_B.md #3
```

```
fix(ab-test): P0 Handle empty array reduce operations

- Check array length before reduce
- Provide proper type definitions for accumulator
- Return null instead of throwing on empty arrays
- Add type guards for rate property access

Fixes: VALIDATION_REPORT_FINAL_B.md #6
```

---

## ⏱️ 예상 수정 시간

| 이슈 | 파일 | 라인 | 복잡도 | 예상 시간 |
|------|------|------|--------|----------|
| #1 | cruisedot-settlement | 131-170 | 낮음 | 5분 |
| #2 | cruisedot-settlement | 162-170 | 낮음 | 5분 |
| #3 | cruisedot-payment | 105-106 | 중간 | 10분 |
| #4 | stats | 44-50 | 중간 | 15분 |
| #5 | cruisedot-settlement | 100 | 낮음 | 5분 |
| #6 | ab-test-results | 97, 145 | 중간 | 10분 |
| **합계** | - | - | - | **50분** |

---

## 체크리스트

- [ ] Issue #1: Settlement metadata `as any` 제거
- [ ] Issue #2: SettlementEvent metadata `as any` 제거
- [ ] Issue #3: Contact 타입 명시화
- [ ] Issue #4: Dashboard NaN/Infinity 체크 추가
- [ ] Issue #5: settlementIdInt isNaN 체크 추가
- [ ] Issue #6: A/B Test empty array handling
- [ ] TypeScript 빌드 성공 (`npx tsc --noEmit`)
- [ ] ESLint 통과 (`npm run lint`)
- [ ] 로컬 테스트 성공 (`npm run dev`)
- [ ] 웹훅 엔드포인트 테스트 성공
- [ ] Dashboard API 테스트 성공
- [ ] Git 커밋 (6개 이슈별로 또는 2개 그룹으로)
- [ ] PR 생성 및 자동 체크 통과

---

**목표**: 2026-05-28 06:00 UTC까지 6개 P0 이슈 모두 수정 및 빌드 성공

