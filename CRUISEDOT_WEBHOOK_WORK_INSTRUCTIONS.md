# 크루즈닷몰 웹훅 엔드포인트 구현 작업지시서

**Status:** 🟢 Ready for Implementation  
**Date:** 2026-05-21  
**Task ID:** #4  
**Architecture:** 동기 처리 (Sync) 방식  

---

## 📋 구현 범위

```
[웹훅 수신]
    ↓
[HMAC-SHA256 검증]
    ↓
[eventId 중복 체크] → ProcessedWebhookEvent
    ↓
[트랜잭션 시작]
    ├─ Contact 상태 업데이트 (lastPaymentStatus, lastRefundedAt)
    ├─ AffiliateSale 처리 (status='REFUNDED', commission=0)
    └─ ProcessedWebhookEvent 기록 (중복 방지)
    ↓
[200 응답]
```

---

## 🛠️ 1단계: Prisma 스키마 수정

### 파일: `prisma/schema.prisma`

#### A. ProcessedWebhookEvent 모델 추가 (이미 있으면 사용)

```prisma
model ProcessedWebhookEvent {
  id            String    @id @default(cuid())
  eventId       String    @unique
  webhookType   String    @db.VarChar(50)  // "cruisedot-payment", "payapp", "refund"
  status        String    @default("SUCCESS") @db.VarChar(20)  // SUCCESS, FAILED
  errorMessage  String?
  processedAt   DateTime  @default(now())
  
  @@index([eventId])
  @@index([webhookType])
  @@index([processedAt])
  @@map("ProcessedWebhookEvent")
}
```

**검증 명령:**
```bash
cd D:/mabiz-crm
grep -A 10 "^model ProcessedWebhookEvent" prisma/schema.prisma
```

---

## 🛠️ 2단계: 웹훅 엔드포인트 구현

### 파일: `src/app/api/webhooks/cruisedot-payment/route.ts` (신규)

```typescript
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface CruisedotPaymentPayload {
  eventId: string;
  eventType: 'payment.created' | 'payment.updated' | 'payment.refunded';
  timestamp: string;
  bookingRef: string;  // CZ-2026-05-00123
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED';
  refundAmount?: number;
  reason?: string;
  refundPolicy?: {
    daysBeforeDeparture: number;
    penaltyRate: number;
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;
  
  // 1️⃣ 환경변수 검증
  if (!secret) {
    logger.error('[CruisedotWebhook] CRUISEDOT_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // 2️⃣ Bearer Token 검증
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  
  if (token !== secret) {
    logger.warn('[CruisedotWebhook] 인증 실패', { token: token.slice(0, 10) + '...' });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 3️⃣ HMAC-SHA256 서명 검증
  const body = await req.text();
  const signature = req.headers.get('x-signature') ?? '';
  const expectedSignature = createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    logger.warn('[CruisedotWebhook] 서명 검증 실패');
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  // 4️⃣ JSON 파싱
  let payload: CruisedotPaymentPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  const { eventId, eventType, timestamp, bookingRef, status, refundAmount, reason } = payload;

  // 5️⃣ 필수 필드 검증
  if (!eventId || !eventType || !bookingRef || !status) {
    logger.warn('[CruisedotWebhook] 필수 필드 누락', { eventId, bookingRef });
    return NextResponse.json({ ok: false, message: '필수 필드 누락' }, { status: 400 });
  }

  logger.log('[CruisedotWebhook] 수신', {
    eventType,
    bookingRef,
    status,
    refundAmount: refundAmount ?? null,
  });

  try {
    // 6️⃣ eventId 멱등성 체크
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
    });
    
    if (alreadyProcessed) {
      logger.log('[CruisedotWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // 7️⃣ Contact 찾기 (bookingRef로)
    const contact = await prisma.contact.findFirst({
      where: { bookingRef },
      select: { id: true, organizationId: true, phone: true },
    });

    // 8️⃣ AffiliateSale 찾기 (bookingRef = orderId인 경우)
    const affiliateSale = await prisma.affiliateSale.findUnique({
      where: { orderId: bookingRef },
      select: { id: true, saleAmount: true, commissionAmount: true },
    });

    // 9️⃣ 트랜잭션 처리
    await prisma.$transaction(async (tx) => {
      // Contact 상태 업데이트
      if (contact) {
        const paymentStatus = status === 'REFUNDED' ? 'refunded' 
                            : status === 'CONFIRMED' ? 'paid'
                            : status === 'CANCELLED' ? 'cancelled'
                            : 'pending';

        await tx.contact.update({
          where: { id: contact.id },
          data: {
            lastPaymentStatus: paymentStatus,
            lastPaymentAt: status === 'CONFIRMED' ? new Date(timestamp) : undefined,
            lastRefundedAt: status === 'REFUNDED' ? new Date(timestamp) : undefined,
            paymentStatusNote: status === 'REFUNDED' 
              ? `환불완료: ${refundAmount ? refundAmount.toLocaleString() + '원' : '금액미상'}`
              : status === 'CONFIRMED'
              ? '결제완료'
              : status === 'CANCELLED'
              ? `취소됨: ${reason || '사유 미기재'}`
              : undefined,
          },
        });

        // Contact 메모 기록
        if (status === 'REFUNDED' || status === 'CANCELLED') {
          const memoContent = [
            `[${status === 'REFUNDED' ? '환불' : '취소'}] 크루즈닷몰 웹훅`,
            refundAmount ? `금액: ${refundAmount.toLocaleString()}원` : null,
            reason ? `사유: ${reason}` : null,
            `이벤트ID: ${eventId}`,
            `처리일시: ${new Date(timestamp).toLocaleString('ko-KR')}`,
          ].filter(Boolean).join('\n');

          await tx.contactMemo.create({
            data: {
              contactId: contact.id,
              userId: 'system-webhook-cruisedot',
              content: memoContent,
            },
          });
        }
      }

      // AffiliateSale 처리 (환불 시)
      if (status === 'REFUNDED' && affiliateSale && affiliateSale.commissionAmount > 0) {
        await tx.affiliateSale.update({
          where: { id: affiliateSale.id },
          data: {
            refundedAmount: affiliateSale.saleAmount,
            refundedAt: new Date(timestamp),
            commissionAmount: 0,  // 100% 취소
            status: 'REFUNDED',
            cancelReason: 'CUSTOMER_REFUND_CRUISEDOT',
          },
        });

        logger.log('[CruisedotWebhook] AffiliateSale 수당 취소', {
          affiliateSaleId: affiliateSale.id,
          originalCommission: affiliateSale.commissionAmount,
          refundAmount,
        });
      }

      // ProcessedWebhookEvent 기록 (중복 방지)
      await tx.processedWebhookEvent.create({
        data: {
          eventId,
          webhookType: 'cruisedot-payment',
          status: 'SUCCESS',
        },
      });
    });

    logger.log('[CruisedotWebhook] 처리 완료', {
      contactFound: !!contact,
      affiliateSaleFound: !!affiliateSale,
      bookingRef,
      status,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[CruisedotWebhook] 처리 실패', { err, eventId });
    
    // 실패 기록
    await prisma.processedWebhookEvent.create({
      data: {
        eventId,
        webhookType: 'cruisedot-payment',
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    }).catch(() => {});

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

## 🛠️ 3단계: Prisma 마이그레이션 & 재생성

```bash
cd D:/mabiz-crm

# 1. Prisma Client 재생성 (ProcessedWebhookEvent 추가)
npx prisma generate

# 2. DB 마이그레이션 (DBA가 나중에 수행)
# npx prisma migrate dev --name add-cruisedot-webhook
```

---

## 🧪 4단계: 로컬 테스트

### 테스트 파일: `src/app/api/webhooks/cruisedot-payment/__tests__/route.test.ts`

```typescript
import { POST } from '../route';
import { createHmac } from 'crypto';

describe('POST /api/webhooks/cruisedot-payment', () => {
  const secret = 'test_secret_12345';
  
  it('should process payment.refunded event', async () => {
    const payload = {
      eventId: 'evt_test_001',
      eventType: 'payment.refunded',
      timestamp: new Date().toISOString(),
      bookingRef: 'CZ-2026-05-00123',
      status: 'REFUNDED',
      refundAmount: 1500000,
      reason: '여행 일정 변경',
    };

    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Mock Request 생성
    const mockReq = new Request('http://localhost:3000/api/webhooks/cruisedot-payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'X-Signature': signature,
        'Content-Type': 'application/json',
      },
      body,
    });

    const res = await POST(mockReq as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });
});
```

---

## 📊 5단계: 체크리스트

구현 단계별 검증:

- [ ] Prisma 스키마 수정 (ProcessedWebhookEvent)
- [ ] `/api/webhooks/cruisedot-payment/route.ts` 생성
- [ ] HMAC-SHA256 검증 테스트
- [ ] eventId 중복 필터링 테스트
- [ ] Contact 업데이트 테스트
- [ ] AffiliateSale 수당 취소 테스트
- [ ] 에러 처리 테스트
- [ ] 로그 기록 검증

---

## 📅 일정

- **2026-05-21 (Day 1)**: Prisma + 기본 구현
- **2026-05-22 (Day 2)**: HMAC + eventId + 트랜잭션 완성
- **2026-05-23 (Day 3)**: 로컬 테스트 + 코드 리뷰
- **2026-05-24 (Day 4)**: 스테이징 배포 + 기초 테스트
- **2026-05-25 (Day 5)**: 크루즈닷몰과 통합 테스트

---

## ⚠️ 주의사항

1. **CRUISEDOT_WEBHOOK_SECRET**
   - 5월22일 오전 제공 예정
   - Vercel staging/production 환경변수에 설정
   - 절대 로그에 출력하지 않기

2. **bookingRef 연결**
   - Contact.bookingRef = Reservation.id (또는 orderId)
   - AffiliateSale.orderId = bookingRef

3. **트랜잭션**
   - Contact + AffiliateSale + ProcessedWebhookEvent 동시 처리
   - 하나라도 실패하면 모두 롤백

4. **재시도**
   - 500 에러 시 크루즈닷몰이 재시도 (우리는 처리 X)
   - eventId로 중복 방지

---

**다음 단계:** Step 4단계부터 바로 구현 시작!
