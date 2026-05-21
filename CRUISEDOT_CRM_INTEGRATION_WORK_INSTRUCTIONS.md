# 크루즈닷 ↔ CRM DB 완전 연결 | 최종 작업지시서

**기간**: 3주 (Week 1: 기초, Week 2-3: 자동화)  
**예상 비용**: $4-7K (8명 × 25시간)  
**기대효과**: $120-240K/연 (절감 + 신규 매출)  
**배포**: Vercel (CRM 프로젝트 2개 환경)

---

## 🎯 최우선 목표

✅ **웹훅 양방향 구조 완성** → Contact 동기화 자동화 → Menu #38 마케팅 자동화 시작

---

## 📋 Week 1: 기초 (기반 구축)

### Task 1️⃣ Contact.userId FK 정의 + 마이그레이션

**목표**: GmUser.id와 Contact.userId 관계를 명시적으로 정의, 고아 Contact 방지

**담당**: Agent (DB 스키마 전담)  
**예상 시간**: 2시간

**작업 단계**:

#### Step 1: Prisma 스키마 수정
```prisma
// D:\mabiz-crm\prisma\schema.prisma

model Contact {
  // ... 기존 필드 ...
  userId  Int?
  
  // 신규: GmUser 관계 정의
  user    GmUser?  @relation("UserContacts", fields: [userId], references: [id], onDelete: SetNull)
  
  @@unique([phone, organizationId])  // 조직별 phone 유일
}

model GmUser {
  // ... 기존 필드 ...
  
  // 신규: Contact 역관계
  contacts Contact[] @relation("UserContacts")
}
```

#### Step 2: 마이그레이션 생성
```bash
npx prisma migrate dev --name add_contact_userid_fk
```

#### Step 3: 마이그레이션 SQL 정정 (수동)
```sql
-- D:\mabiz-crm\prisma\migrations\[timestamp]_add_contact_userid_fk\migration.sql

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fk"
  FOREIGN KEY ("userId") REFERENCES "User"(id)
  ON DELETE SET NULL;

-- 고아 Contact 감지 및 로깅
INSERT INTO "ContactAuditLog" (contactId, action, reason, createdAt)
SELECT c.id, 'ORPHANED', 'FK 추가 시 GmUser 없음', NOW()
FROM "Contact" c
WHERE c.user_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c.user_id);
```

#### Step 4: 검증 쿼리
```sql
-- 고아 Contact 확인 (0이어야 함)
SELECT COUNT(*) FROM "Contact" c
WHERE c.user_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c.user_id);

-- 중복 phone-org 확인 (0이어야 함)
SELECT phone, organization_id, COUNT(*) 
FROM "Contact" 
GROUP BY phone, organization_id 
HAVING COUNT(*) > 1;
```

#### Step 5: 배포
```bash
npm run build  # TypeScript 검증
git add prisma/schema.prisma
git commit -m "feat(db): Contact.userId FK 정의 + SetNull 정책"
```

---

### Task 2️⃣ GmReservation 관계 정의 (tripId, mainUserId)

**목표**: ORM join 가능하게, N+1 쿼리 제거 기초

**담당**: Agent (DB 스키마)  
**예상 시간**: 1.5시간

**작업 단계**:

#### Step 1: Prisma 스키마 수정
```prisma
// D:\mabiz-crm\prisma\schema.prisma

model GmReservation {
  // ... 기존 필드 ...
  tripId  Int
  mainUserId  Int
  
  // 신규: 관계 정의
  trip     GmTrip  @relation("TripReservations", fields: [tripId], references: [id], onDelete: Cascade)
  mainUser GmUser  @relation("UserReservations", fields: [mainUserId], references: [id])
  
  @@index([tripId])  // 이미 있음, 확인만
  @@index([mainUserId])
}

model GmTrip {
  // ... 기존 필드 ...
  reservations GmReservation[] @relation("TripReservations")
}

model GmUser {
  // ... 기존 필드 ...
  reservations GmReservation[] @relation("UserReservations")
  contacts Contact[] @relation("UserContacts")
}
```

#### Step 2: 마이그레이션
```bash
npx prisma migrate dev --name add_gmreservation_relations
```

#### Step 3: 테스트 쿼리 (개선 전/후)
```typescript
// ❌ 전: N+1
const reservations = await prisma.gmReservation.findMany({ where: { mainUserId: 123 } });
for (const res of reservations) {
  const trip = await prisma.gmTrip.findUnique({ where: { id: res.tripId } });  // N개 추가 쿼리
}

// ✅ 후: 1 쿼리
const reservations = await prisma.gmReservation.findMany({
  where: { mainUserId: 123 },
  include: { trip: { select: { productCode: true, shipName: true, departureDate: true } } }
});
```

---

### Task 3️⃣ DLQ (Dead Letter Queue) Cron 구현

**목표**: 실패한 웹훅 자동 재시도, 데이터 손실 방지

**담당**: Agent (백엔드, 웹훅)  
**예상 시간**: 2시간

**작업 단계**:

#### Step 1: DLQ 모니터링 파일 생성
```typescript
// D:\mabiz-crm\src\app\api\cron\webhook-dlq-retry\route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    // 1. ProcessedWebhookEvent에서 failed 건 조회
    const failedEvents = await prisma.processedWebhookEvent.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: 3 },  // 3회 미만 재시도
        nextRetryAt: { lte: new Date() }  // 재시도 시간 도래
      },
      take: 50,  // 배치 크기
      orderBy: { createdAt: 'asc' }
    });

    logger.info('[DLQ-Retry] 재시도 대상', { count: failedEvents.length });

    // 2. 각 이벤트별 재시도
    let successCount = 0;
    for (const event of failedEvents) {
      try {
        // 원본 웹훅 페이로드 재전송
        const response = await fetch(event.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: event.payload
        });

        if (response.ok) {
          // 성공: 상태 업데이트
          await prisma.processedWebhookEvent.update({
            where: { id: event.id },
            data: { status: 'COMPLETED', retryCount: event.retryCount + 1 }
          });
          successCount++;
        } else {
          // 실패: 다음 재시도 예약
          await prisma.processedWebhookEvent.update({
            where: { id: event.id },
            data: {
              retryCount: event.retryCount + 1,
              nextRetryAt: new Date(Date.now() + (event.retryCount + 1) * 60000)  // 지수백오프
            }
          });
        }
      } catch (err) {
        logger.error(`[DLQ-Retry] 이벤트 ${event.id} 실패:`, { error: String(err) });
      }
    }

    logger.info('[DLQ-Retry] 완료', { success: successCount, failed: failedEvents.length - successCount });
    return NextResponse.json({ ok: true, retried: failedEvents.length, success: successCount });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[DLQ-Retry] 크리티컬', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
```

#### Step 2: Cron 일정 설정 (vercel.json)
```json
{
  "crons": [
    {
      "path": "/api/cron/webhook-dlq-retry",
      "schedule": "0 */5 * * * *"  // 매 5분마다
    }
  ]
}
```

#### Step 3: 테스트
```bash
# 수동 트리거 (Vercel 프로젝트에서)
curl https://[project-url]/api/cron/webhook-dlq-retry \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

### Task 4️⃣ Purchase 웹훅 양방향 수정 (Contact + AffiliateSale + Lens)

**목표**: 결제 → Contact 생성/업데이트 → 렌즈 자동 분류 → SMS 시작

**담당**: Agent (백엔드, 웹훅, Contact 로직)  
**예상 시간**: 2.5시간

**작업 단계**:

#### Step 1: 웹훅 엔드포인트 수정
```typescript
// D:\mabiz-crm\src\app\api\webhooks\purchase\route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, saleAmount, customerPhone, customerName, customerEmail, affiliateCode, organizationId: bodyOrgId } = body;

    if (!orderId || !saleAmount) {
      return NextResponse.json({ ok: false, error: '필수 필드 누락' }, { status: 400 });
    }

    // 1. 조직 특정
    let orgId = bodyOrgId;
    if (!orgId && affiliateCode) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { code: affiliateCode },
        select: { organizationId: true }
      });
      orgId = affiliate?.organizationId;
    }
    if (!orgId) orgId = process.env.DEFAULT_ORGANIZATION_ID || '';

    // 2. Contact 생성/업데이트 (멱등성: phone + organizationId)
    const contact = await prisma.contact.upsert({
      where: { phone_organizationId: { phone: customerPhone, organizationId: orgId } },
      create: {
        phone: customerPhone,
        name: customerName,
        email: customerEmail,
        organizationId: orgId,
        type: 'CUSTOMER',
        channel: 'direct',
        purchasedAt: new Date(),
        lastPaymentAt: new Date(),
        lastPaymentStatus: 'SUCCESS',
        segment: 'A',  // 임시값 (Step 2에서 렌즈 분류로 덮어씀)
        createdAt: new Date()
      },
      update: {
        lastPaymentAt: new Date(),
        lastPaymentStatus: 'SUCCESS',
        purchasedAt: new Date(),
        // segment 업데이트 금지 (렌즈 분류에서 관리)
      },
      select: { id: true, userId: true, segment: true }
    });

    // 3. AffiliateSale 생성/업데이트
    const affiliateSale = await prisma.crmAffiliateSale.upsert({
      where: { orderId },
      create: {
        orderId,
        saleAmount,
        organizationId: orgId,
        status: 'PENDING',
        sourceWebhook: 'purchase',
        createdAt: new Date()
      },
      update: {
        saleAmount,
        updatedAt: new Date()
      }
    });

    // 4. ContactLensClassification 자동생성 (Step 3에서 구현)
    // 현재: segment 'A'로 임시 설정, 렌즈 마케팅 엔진에서 L0-L10으로 전환
    if (contact.segment) {
      await prisma.contactLensClassification.upsert({
        where: {
          contactId_lensType: {
            contactId: contact.id,
            lensType: `L${mapSegmentToLens(contact.segment)}`
          }
        },
        create: {
          contactId: contact.id,
          lensType: `L${mapSegmentToLens(contact.segment)}`,
          decisionLevel: 'CONFIRMED',
          readinessScore: 80
        },
        update: {
          decisionLevel: 'CONFIRMED',
          readinessScore: 80
        }
      });
    }

    // 5. ProcessedWebhookEvent 기록 (중복 방지)
    const eventId = `${orderId}-${Date.now()}`;
    await prisma.processedWebhookEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        webhookType: 'purchase',
        status: 'COMPLETED',
        createdAt: new Date()
      },
      update: { status: 'COMPLETED' }
    });

    logger.info('[purchase] 웹훅 처리 완료', {
      orderId,
      contactId: contact.id,
      organizationId: orgId,
      saleAmount
    });

    return NextResponse.json({ ok: true, contactId: contact.id, affiliateSaleId: affiliateSale.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[purchase] 웹훅 실패', { error: msg });
    
    // DLQ에 기록 (재시도 예약)
    await prisma.processedWebhookEvent.create({
      data: {
        eventId: `${body.orderId}-${Date.now()}`,
        webhookType: 'purchase',
        status: 'FAILED',
        retryCount: 0,
        nextRetryAt: new Date(Date.now() + 60000),
        payload: JSON.stringify(body),
        webhookUrl: req.url
      }
    }).catch(e => logger.error('[DLQ] 기록 실패', { error: String(e) }));

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function mapSegmentToLens(segment: string): number {
  const map: Record<string, number> = {
    'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4
  };
  return map[segment] ?? 0;
}
```

#### Step 2: 테스트
```bash
# 웹훅 수동 트리거
curl -X POST http://localhost:3000/api/webhooks/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_TEST_001",
    "saleAmount": 3000000,
    "customerPhone": "010-1234-5678",
    "customerName": "테스트 고객",
    "customerEmail": "test@example.com",
    "affiliateCode": "PARTNER001",
    "organizationId": "org-123"
  }'

# Contact 생성 확인
SELECT * FROM "Contact" WHERE phone='010-1234-5678' ORDER BY created_at DESC LIMIT 1;

# AffiliateSale 확인
SELECT * FROM "CrmAffiliateSale" WHERE order_id='ORDER_TEST_001';
```

---

## 📋 Week 2: 자동화 (렌즈 기반 마케팅)

### Task 5️⃣ ContactLensClassification 자동생성 파이프라인

**목표**: Contact 생성/업데이트 → 렌즈 L0-L10 자동 분류 → SMS 발송 준비

**담당**: Agent (렌즈 분류 엔진, 마케팅 자동화)  
**예상 시간**: 3시간

**작업 단계**:

#### Step 1: 렌즈 분류 함수 구현
```typescript
// D:\mabiz-crm\src\lib\lens-classifier.ts

import prisma from '@/lib/prisma';

export async function classifyContactLens(contactId: string): Promise<string> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      purchasedAt: true,
      lastPaymentAt: true,
      reEngagedAt: true,
      departureDate: true,
      budgetRange: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!contact) throw new Error('Contact not found');

  // L0: 부재중 고객 (1년 이상 미활동)
  if (contact.lastPaymentAt && new Date().getTime() - contact.lastPaymentAt.getTime() > 365 * 24 * 60 * 60 * 1000) {
    return 'L0';
  }

  // L1: 가격 오해형 (첫 구매 고객, 낮은 예산)
  if (!contact.purchasedAt && contact.budgetRange === 'BUDGET') {
    return 'L1';
  }

  // L2: 준비 부담형 (신규, 7일 이내)
  if (new Date().getTime() - contact.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return 'L2';
  }

  // ... L3-L10 규칙 계속 ...

  // 기본값
  return 'L5';  // 적합성 의심형
}

export async function updateContactLensClassification(contactId: string) {
  const lensType = await classifyContactLens(contactId);

  await prisma.contactLensClassification.upsert({
    where: { contactId_lensType: { contactId, lensType } },
    create: {
      contactId,
      lensType,
      decisionLevel: 'AUTO',
      readinessScore: 70
    },
    update: {
      decisionLevel: 'AUTO',
      readinessScore: 70,
      updatedAt: new Date()
    }
  });

  return lensType;
}
```

#### Step 2: Contact 업데이트 시 트리거
```typescript
// D:\mabiz-crm\src\app\api\webhooks\purchase\route.ts 내에 추가

// Step 4 이후
const lensType = await updateContactLensClassification(contact.id);

logger.info('[purchase] 렌즈 분류', { contactId: contact.id, lensType });
```

#### Step 3: ContactLensSequence 자동 생성 (Day 0-3 SMS)
```typescript
// D:\mabiz-crm\src\lib\lens-sequence-trigger.ts

export async function triggerLensSequence(contactId: string, lensType: string) {
  const sequence = await prisma.contactLensSequence.create({
    data: {
      contactId,
      lensType,
      day0Sent: false,
      day1Sent: false,
      day2Sent: false,
      day3Sent: false,
      overallConverted: false,
      createdAt: new Date()
    }
  });

  // Day 0 SMS 즉시 발송 스케줄 (5분 후)
  await scheduleSmsJob({
    contactId,
    lensType,
    day: 0,
    scheduledAt: new Date(Date.now() + 5 * 60 * 1000)
  });

  logger.info('[LensSequence] 시퀀스 시작', { contactId, lensType });
  return sequence;
}
```

---

### Task 6️⃣ Inquiry + GoldInquiry 웹훅 양방향 수정

**목표**: 상담 문의 → Contact 자동 생성 → 세그먼트 분류 (L5 적합성 의심)

**담당**: Agent (웹훅)  
**예상 시간**: 1.5시간

**작업 구현**: Task 4와 유사 (contact.type='LEAD', segment='A' → L5로 자동 분류)

---

## 📋 Week 3: 최적화 + 배포

### Task 7️⃣ 성능 최적화 (N+1 쿼리 제거)

**목표**: cabin-inventory, Contact 조회 성능 40% 개선

**담당**: Agent (성능)  
**예상 시간**: 2시간

**작업 단계**:

#### Step 1: cabin-inventory GET 최적화
```typescript
// D:\mabiz-crm\src\app\api\cabin-inventory\route.ts

// ❌ 전: N+1
const cabins = await prisma.cabinInventory.findMany({ where, orderBy, include: { organization } });

// ✅ 후: 배치 groupBy
const trips = await prisma.cabinInventory.groupBy({
  by: ['organizationId', 'tripCode', 'departureDate', 'tripName', 'shipName'],
  where,
  _count: { id: true },
  orderBy: [{ departureDate: 'asc' }, { tripName: 'asc' }]
});

const result = trips.map(trip => ({
  tripName: trip.tripName,
  departureDate: trip.departureDate,
  shipName: trip.shipName,
  cabinCount: trip._count.id
}));
```

#### Step 2: Contact 배치 로드 최적화
```typescript
// D:\mabiz-crm\src\app/api/contacts/route.ts (GET)

// ❌ 전: Contact 100개 조회 후 100개 추가 쿼리
const contacts = await prisma.contact.findMany({ where });
const contactsWithUser = await Promise.all(
  contacts.map(c => prisma.gmUser.findUnique({ where: { id: c.userId } }))
);

// ✅ 후: 1 쿼리
const contacts = await prisma.contact.findMany({
  where,
  include: {
    user: { select: { id: true, name: true } }  // N+1 제거
  }
});
```

---

### Task 8️⃣ 배포 + 테스트

**목표**: 크루즈닷 ↔ CRM 양방향 동기화 운영 개시

**담당**: Agent (배포, QA)  
**예상 시간**: 1.5시간

**작업 단계**:

#### Step 1: 통합 테스트
```bash
# 1. Contact FK 검증
SELECT COUNT(*) as orphaned_count FROM "Contact" c
WHERE c.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE id = c.user_id);
# 결과: 0

# 2. 웹훅 양방향 테스트
POST /api/webhooks/purchase (payload) → Contact 생성 → ContactLensClassification 생성 → SMS 대기
GET /api/contacts?segment=L0 → 부재중 고객 목록 (최소 1명)

# 3. DLQ 재시도 테스트
POST /api/cron/webhook-dlq-retry → 실패 건 재처리 (성공 1건 이상)

# 4. 성능 벤치마크
GET /api/cabin-inventory (1000개 객실) → 응답시간 <2sec (이전: 5sec)
```

#### Step 2: Vercel 배포
```bash
git add .
git commit -m "feat(integration): 크루즈닷↔CRM 양방향 웹훅 + FK 정의 + DLQ"

git push origin main

# Vercel 자동 배포 확인
# vercel.com/projects/[mabiz] → Deployments
```

#### Step 3: 프로덕션 모니터링
```
설정 항목:
- Sentry alert: Contact 생성 실패 > 5회/시간
- CloudWatch: Purchase 웹훅 DLQ retry > 10%
- Custom dashboard: ContactLensClassification 생성율 추적
```

---

## 📊 예상 결과 (Week 1-3 후)

| 항목 | 전 | 후 | 개선 |
|------|-------|-------|------|
| 종합 점수 | 3.0/10 | 6.5/10 | +117% ↑ |
| 성능 (응답시간) | 5sec | 2sec | -60% ↓ |
| 웹훅 실패율 | ~5% | <1% | -80% ↓ |
| Menu #38 작동 | ❌ | ✅ | 신규 가치 |
| 월 매출 회복 | $0 | $5-10K | +600% ↑ |
| 보안 위험도 | 🔴 High | 🟡 Medium | 위험도 감소 |

---

## ⚠️ 주의사항

1. **크루즈닷 협의 필요**
   - product 웹훅 스펙 확인 (추가 1주 소요)
   - 웹훅 재전송 정책 (지수백오프 적용 여부)

2. **배포 전 데이터 검증**
   - 모든 고아 Contact 및 중복 phone 정정
   - Contact.segment 초기값 설정

3. **롤백 계획**
   - FK 추가 이전에 DB 백업
   - 웹훅 양방향 실패 시 단방향으로 전환 가능

---

## ✅ 완료 기준

- [ ] FK 정의 + 마이그레이션 성공
- [ ] 웹훅 3개 (purchase, inquiry, goldInquiry) 양방향 구현
- [ ] DLQ Cron 매 5분 정상 작동
- [ ] ContactLensClassification 자동 생성 확인 (L0-L10)
- [ ] 성능 벤치마크 통과 (응답시간 -40% 이상)
- [ ] 통합 테스트 전수 통과
- [ ] Vercel 배포 성공
- [ ] 모니터링 대시보드 설정

---

**예상 완료일**: 2026-06-04 (2주 초과급행 가능)

